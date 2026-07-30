import { Router } from "express";
import { z } from "zod";
import { prisma } from "../db";
import { requireAuth, requireRole } from "../middleware/auth";
import { METODOS_PAGO } from "../constants";
import { getInvoicingProvider } from "../services/invoicing";

const router = Router();
router.use(requireAuth);

const itemSchema = z.object({
  productoId: z.number().int(),
  cantidad: z.number().positive(),
  descuento: z.number().min(0).default(0),
});

const ventaSchema = z.object({
  clienteId: z.number().int().nullish(),
  items: z.array(itemSchema).min(1),
  metodoPago: z.enum(METODOS_PAGO).default("EFECTIVO"),
  efectivoRecibido: z.number().min(0).nullish(),
});

// Calcula base gravable e IVA asumiendo que precioVenta ya incluye IVA
// (así se exhiben los precios al consumidor final en Colombia).
function calcularItem(precioUnitario: number, cantidad: number, descuento: number, ivaTasa: number) {
  const totalConIva = precioUnitario * cantidad - descuento;
  const base = totalConIva / (1 + ivaTasa / 100);
  const iva = totalConIva - base;
  return { totalConIva, base, iva };
}

router.get("/", async (req, res) => {
  const { desde, hasta, estado } = req.query;
  const where: Record<string, unknown> = {};
  if (estado) where.estado = String(estado);
  if (desde || hasta) {
    where.createdAt = {
      ...(desde ? { gte: new Date(String(desde)) } : {}),
      ...(hasta ? { lte: new Date(String(hasta)) } : {}),
    };
  }
  const ventas = await prisma.venta.findMany({
    where,
    include: {
      cliente: true,
      usuario: { select: { nombre: true } },
      _count: { select: { items: true } },
    },
    orderBy: { createdAt: "desc" },
    take: 300,
  });
  res.json(ventas);
});

router.get("/:id", async (req, res) => {
  const venta = await prisma.venta.findUnique({
    where: { id: Number(req.params.id) },
    include: {
      cliente: true,
      usuario: { select: { nombre: true } },
      items: { include: { producto: true } },
    },
  });
  if (!venta) return res.status(404).json({ error: "Venta no encontrada" });
  res.json(venta);
});

router.post("/", async (req, res) => {
  const parsed = ventaSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  const { clienteId, items, metodoPago, efectivoRecibido } = parsed.data;

  const productos = await prisma.producto.findMany({
    where: { id: { in: items.map((i) => i.productoId) } },
  });
  const productosPorId = new Map(productos.map((p) => [p.id, p]));

  for (const item of items) {
    const producto = productosPorId.get(item.productoId);
    if (!producto) return res.status(404).json({ error: `Producto ${item.productoId} no encontrado` });
    if (!producto.activo) return res.status(400).json({ error: `${producto.nombre} no está disponible` });
    if (producto.stock < item.cantidad) {
      return res.status(400).json({
        error: `Stock insuficiente de "${producto.nombre}" (disponible: ${producto.stock})`,
      });
    }
  }

  let subtotal = 0;
  let ivaTotal = 0;
  let descuentoTotal = 0;
  let total = 0;
  const itemsData = items.map((item) => {
    const producto = productosPorId.get(item.productoId)!;
    const { totalConIva, base, iva } = calcularItem(
      producto.precioVenta,
      item.cantidad,
      item.descuento,
      producto.ivaTasa
    );
    subtotal += base;
    ivaTotal += iva;
    descuentoTotal += item.descuento;
    total += totalConIva;
    return {
      productoId: producto.id,
      nombreProducto: producto.nombre,
      cantidad: item.cantidad,
      precioUnitario: producto.precioVenta,
      ivaTasa: producto.ivaTasa,
      descuento: item.descuento,
      subtotal: totalConIva,
    };
  });

  if (metodoPago === "EFECTIVO" && efectivoRecibido != null && efectivoRecibido < total) {
    return res.status(400).json({ error: "El efectivo recibido es menor que el total de la venta" });
  }

  const ultima = await prisma.venta.findFirst({
    where: { prefijo: "POS" },
    orderBy: { numero: "desc" },
  });
  const numero = (ultima?.numero ?? 0) + 1;

  const venta = await prisma.$transaction(async (tx) => {
    const nueva = await tx.venta.create({
      data: {
        numero,
        prefijo: "POS",
        clienteId: clienteId ?? null,
        usuarioId: req.user!.id,
        subtotal,
        descuento: descuentoTotal,
        ivaTotal,
        total,
        metodoPago,
        efectivoRecibido: efectivoRecibido ?? null,
        cambio: efectivoRecibido != null ? efectivoRecibido - total : null,
        items: { create: itemsData },
      },
      include: { items: { include: { producto: true } }, cliente: true, usuario: { select: { nombre: true } } },
    });

    for (const item of itemsData) {
      await tx.producto.update({
        where: { id: item.productoId },
        data: { stock: { decrement: item.cantidad } },
      });
      await tx.movimientoInventario.create({
        data: {
          productoId: item.productoId,
          tipo: "VENTA",
          cantidad: item.cantidad,
          usuarioId: req.user!.id,
          ventaId: nueva.id,
        },
      });
    }

    return nueva;
  });

  const resultado = await intentarFacturar(venta.id);
  res.status(201).json(resultado);
});

// Intenta emitir la venta ante la DIAN si la facturación electrónica está
// habilitada en Configuración. Si falla (sin credenciales, proveedor caído,
// etc.) la venta queda como documento POS interno y se puede reintentar
// después: nunca se bloquea el cierre de la venta por un problema de facturación.
async function intentarFacturar(ventaId: number) {
  const config = await prisma.configuracion.upsert({
    where: { id: 1 },
    update: {},
    create: {},
  });

  const venta = await prisma.venta.findUniqueOrThrow({
    where: { id: ventaId },
    include: { items: { include: { producto: true } }, cliente: true, usuario: { select: { nombre: true } } },
  });

  if (!config.facturacionElectronicaHabilitada) {
    return { venta, facturacionElectronicaError: null as string | null };
  }

  try {
    const provider = getInvoicingProvider(config);
    const resultado = await provider.emitir(venta, config);
    const actualizada = await prisma.venta.update({
      where: { id: ventaId },
      data: {
        tipoDocumento: resultado.tipoDocumento,
        cufe: resultado.cufe,
        urlQr: resultado.urlQr,
        proveedorFactura: resultado.proveedor,
      },
      include: { items: { include: { producto: true } }, cliente: true, usuario: { select: { nombre: true } } },
    });
    return { venta: actualizada, facturacionElectronicaError: null as string | null };
  } catch (err) {
    console.warn(`No se pudo facturar electrónicamente la venta ${ventaId}:`, err);
    return {
      venta,
      facturacionElectronicaError:
        err instanceof Error ? err.message : "Error desconocido al facturar electrónicamente",
    };
  }
}

// Reintentar facturación electrónica de una venta que quedó como documento POS.
router.post("/:id/facturar", requireRole("ADMIN"), async (req, res) => {
  const id = Number(req.params.id);
  const venta = await prisma.venta.findUnique({ where: { id } });
  if (!venta) return res.status(404).json({ error: "Venta no encontrada" });
  if (venta.estado === "ANULADA") return res.status(400).json({ error: "La venta está anulada" });

  const resultado = await intentarFacturar(id);
  res.json(resultado);
});

const anularSchema = z.object({ motivo: z.string().min(1) });

router.post("/:id/anular", requireRole("ADMIN"), async (req, res) => {
  const parsed = anularSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  const id = Number(req.params.id);

  const venta = await prisma.venta.findUnique({ where: { id }, include: { items: true } });
  if (!venta) return res.status(404).json({ error: "Venta no encontrada" });
  if (venta.estado === "ANULADA") return res.status(400).json({ error: "La venta ya estaba anulada" });

  await prisma.$transaction(async (tx) => {
    await tx.venta.update({
      where: { id },
      data: { estado: "ANULADA", motivoAnulacion: parsed.data.motivo },
    });
    for (const item of venta.items) {
      await tx.producto.update({
        where: { id: item.productoId },
        data: { stock: { increment: item.cantidad } },
      });
      await tx.movimientoInventario.create({
        data: {
          productoId: item.productoId,
          tipo: "DEVOLUCION",
          cantidad: item.cantidad,
          motivo: `Anulación de venta #${venta.prefijo}-${venta.numero}: ${parsed.data.motivo}`,
          usuarioId: req.user!.id,
          ventaId: venta.id,
        },
      });
    }
  });

  res.status(204).send();
});

export default router;
