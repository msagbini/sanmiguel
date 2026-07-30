import { Router } from "express";
import { z } from "zod";
import { prisma } from "../db";
import { requireAuth, requireRole } from "../middleware/auth";
import { METODOS_PAGO, IVA_TASAS } from "../constants";
import { getInvoicingProvider } from "../services/invoicing";

const router = Router();
router.use(requireAuth);

const VENTA_INCLUDE = {
  items: { include: { producto: true } },
  cliente: true,
  usuario: { select: { nombre: true } },
} as const;

// productoId ausente = "producto libre": algo que no está en el catálogo y se
// agrega a mano (nombre, precio e IVA los define quien vende). precioUnitario
// también sirve para sobreescribir el precio de un producto del catálogo
// (precio mayorista, negociado, etc.).
const itemSchema = z
  .object({
    productoId: z.number().int().nullish(),
    nombreProducto: z.string().min(1).optional(),
    cantidad: z.number().positive(),
    precioUnitario: z.number().min(0).optional(),
    ivaTasa: z.number().optional(),
    costoUnitarioLibre: z.number().min(0).optional(),
    descuento: z.number().min(0).default(0),
  })
  .refine((item) => item.productoId != null || (item.nombreProducto && item.precioUnitario != null), {
    message: "Un producto libre necesita nombre y precio",
  });

const ventaSchema = z.object({
  clienteId: z.number().int().nullish(),
  items: z.array(itemSchema).min(1),
  metodoPago: z.enum(METODOS_PAGO).default("EFECTIVO"),
  efectivoRecibido: z.number().min(0).nullish(),
});

// Calcula base gravable e IVA asumiendo que precioUnitario ya incluye IVA
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
    include: VENTA_INCLUDE,
  });
  if (!venta) return res.status(404).json({ error: "Venta no encontrada" });
  res.json(venta);
});

router.post("/", async (req, res) => {
  const parsed = ventaSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  const { clienteId, items, metodoPago, efectivoRecibido } = parsed.data;

  const idsProductos = items.map((i) => i.productoId).filter((id): id is number => id != null);
  const productos = await prisma.producto.findMany({ where: { id: { in: idsProductos } } });
  const productosPorId = new Map(productos.map((p) => [p.id, p]));

  for (const item of items) {
    if (item.productoId == null) {
      if (!IVA_TASAS.includes(item.ivaTasa as (typeof IVA_TASAS)[number])) {
        return res.status(400).json({ error: `IVA inválido para "${item.nombreProducto}"` });
      }
      continue;
    }
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
  let brutoSinDescuento = 0;
  const itemsData = items.map((item) => {
    const producto = item.productoId != null ? productosPorId.get(item.productoId)! : null;
    const precioUnitario = item.precioUnitario ?? producto?.precioVenta ?? 0;
    const ivaTasa = producto?.ivaTasa ?? item.ivaTasa ?? 0;
    const { totalConIva, base, iva } = calcularItem(precioUnitario, item.cantidad, item.descuento, ivaTasa);
    subtotal += base;
    ivaTotal += iva;
    descuentoTotal += item.descuento;
    total += totalConIva;
    brutoSinDescuento += precioUnitario * item.cantidad;
    return {
      productoId: producto?.id ?? null,
      nombreProducto: producto?.nombre ?? item.nombreProducto!,
      cantidad: item.cantidad,
      precioUnitario,
      costoUnitarioLibre: producto ? null : (item.costoUnitarioLibre ?? 0),
      ivaTasa,
      descuento: item.descuento,
      subtotal: totalConIva,
    };
  });

  if (metodoPago === "EFECTIVO" && efectivoRecibido != null && efectivoRecibido < total) {
    return res.status(400).json({ error: "El efectivo recibido es menor que el total de la venta" });
  }

  const config = await prisma.configuracion.upsert({ where: { id: 1 }, update: {}, create: {} });

  // Protección de margen: un cajero no puede regalar más descuento del
  // tope configurado sin que un administrador lo autorice desde su propia sesión.
  if (req.user!.rol === "CAJERO" && brutoSinDescuento > 0) {
    const descuentoPct = (descuentoTotal / brutoSinDescuento) * 100;
    if (descuentoPct > config.descuentoMaximoCajeroPct) {
      return res.status(403).json({
        error: `El descuento (${descuentoPct.toFixed(1)}%) supera el máximo permitido para cajeros (${config.descuentoMaximoCajeroPct}%). Pide a un administrador que lo aplique.`,
      });
    }
  }

  let cliente = clienteId ? await prisma.cliente.findUnique({ where: { id: clienteId } }) : null;

  if (metodoPago === "CREDITO") {
    if (!cliente || cliente.esConsumidorFinal) {
      return res.status(400).json({ error: "Para fiar una venta hay que identificar al cliente" });
    }
    if (cliente.limiteCredito <= 0) {
      return res.status(400).json({ error: `${cliente.nombre} no tiene cupo de fiado habilitado` });
    }
    if (cliente.saldoPendiente + total > cliente.limiteCredito) {
      const disponible = Math.max(0, cliente.limiteCredito - cliente.saldoPendiente);
      return res.status(400).json({
        error: `${cliente.nombre} no tiene cupo suficiente para fiar $${total.toFixed(0)} (debe $${cliente.saldoPendiente.toFixed(0)}, cupo disponible $${disponible.toFixed(0)})`,
      });
    }
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
        efectivoRecibido: metodoPago === "EFECTIVO" ? (efectivoRecibido ?? null) : null,
        cambio: metodoPago === "EFECTIVO" && efectivoRecibido != null ? efectivoRecibido - total : null,
        items: { create: itemsData },
      },
      include: VENTA_INCLUDE,
    });

    for (const item of itemsData) {
      if (item.productoId == null) continue; // los productos libres no afectan inventario
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

    if (metodoPago === "CREDITO" && cliente) {
      const nuevoSaldo = cliente.saldoPendiente + total;
      await tx.cliente.update({ where: { id: cliente.id }, data: { saldoPendiente: nuevoSaldo } });
      await tx.cuentaCorrienteMovimiento.create({
        data: {
          clienteId: cliente.id,
          tipo: "CARGO",
          monto: total,
          saldoResultante: nuevoSaldo,
          ventaId: nueva.id,
          motivo: `Venta fiada #${nueva.prefijo}-${nueva.numero}`,
          usuarioId: req.user!.id,
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
    include: VENTA_INCLUDE,
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
      include: VENTA_INCLUDE,
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
      if (item.productoId == null) continue;
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

    // Si era una venta fiada, se reversa la deuda que había generado en la cuenta del cliente.
    if (venta.metodoPago === "CREDITO" && venta.clienteId) {
      const cliente = await tx.cliente.findUniqueOrThrow({ where: { id: venta.clienteId } });
      const nuevoSaldo = cliente.saldoPendiente - venta.total;
      await tx.cliente.update({ where: { id: cliente.id }, data: { saldoPendiente: nuevoSaldo } });
      await tx.cuentaCorrienteMovimiento.create({
        data: {
          clienteId: cliente.id,
          tipo: "AJUSTE",
          monto: -venta.total,
          saldoResultante: nuevoSaldo,
          ventaId: venta.id,
          motivo: `Reversa por anulación de venta #${venta.prefijo}-${venta.numero}: ${parsed.data.motivo}`,
          usuarioId: req.user!.id,
        },
      });
    }
  });

  res.status(204).send();
});

export default router;
