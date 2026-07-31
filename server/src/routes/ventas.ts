import { Router } from "express";
import { z } from "zod";
import { prisma } from "../db";
import { requireAuth, requireRole } from "../middleware/auth";
import { METODOS_PAGO, IVA_TASAS } from "../constants";
import { getInvoicingProvider } from "../services/invoicing";
import { consumirLotesFEFO } from "../services/lotes";

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
    productoId: z.number().int().positive().nullish(),
    nombreProducto: z.string().min(1).max(200).optional(),
    cantidad: z.number().positive().finite().max(100000),
    precioUnitario: z.number().min(0).finite().max(1_000_000_000).optional(),
    ivaTasa: z.number().finite().optional(),
    costoUnitarioLibre: z.number().min(0).finite().max(1_000_000_000).optional(),
    descuento: z.number().min(0).finite().max(1_000_000_000).default(0),
  })
  .refine((item) => item.productoId != null || (item.nombreProducto && item.precioUnitario != null), {
    message: "Un producto libre necesita nombre y precio",
  });

const ventaSchema = z.object({
  clienteId: z.number().int().positive().nullish(),
  // Un tope generoso para cualquier venta real (mayorista incluido); evita
  // que un request con miles de líneas agote CPU/memoria calculando totales.
  items: z.array(itemSchema).min(1).max(500),
  metodoPago: z.enum(METODOS_PAGO).default("EFECTIVO"),
  efectivoRecibido: z.number().min(0).finite().max(1_000_000_000).nullish(),
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
    if (!config.habilitarFiado) {
      return res.status(400).json({ error: "El fiado está deshabilitado en Configuración" });
    }
    if (!cliente || cliente.esConsumidorFinal) {
      return res.status(400).json({ error: "Para fiar una venta hay que identificar al cliente" });
    }
    if (!cliente.estudioCreditoAprobado) {
      return res.status(400).json({
        error: `${cliente.nombre} no tiene un estudio de crédito aprobado. Se necesitan mínimo 2 codeudores y 2 referencias verificados y aprobados por un administrador antes de poder fiarle.`,
      });
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

  const turnoAbierto = await prisma.turno.findFirst({ where: { cerradoEn: null } });

  let venta;
  try {
    venta = await prisma.$transaction(async (tx) => {
        // Contador atómico: leer MAX(numero) antes de la transacción dejaba
        // que dos ventas concurrentes calcularan el mismo "siguiente número"
        // y chocaran contra la restricción única (prefijo, numero). Este
        // `increment` es una sola operación UPDATE que SQLite serializa por
        // sí sola, así que cada venta recibe un número distinto garantizado,
        // sin reintentos ni colisiones posibles.
        const contador = await tx.configuracion.update({
          where: { id: 1 },
          data: { ultimoNumeroVentaPos: { increment: 1 } },
        });
        const numero = contador.ultimoNumeroVentaPos;

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
            turnoId: turnoAbierto?.id ?? null,
            items: { create: itemsData },
          },
          include: VENTA_INCLUDE,
        });

        for (const item of itemsData) {
          if (item.productoId == null) continue; // los productos libres no afectan inventario
          // Decremento atómico con guarda: el chequeo de stock de más arriba
          // lee ANTES de abrir la transacción, así que dos ventas
          // concurrentes (o dos líneas del mismo producto en la misma venta)
          // podrían pasar esa validación y sobrevender. `updateMany` con
          // `stock: { gte }` hace que la base de datos solo aplique el
          // descuento si en ese instante todavía alcanza, y lo confirma con
          // `count`; si no, se aborta toda la venta.
          const resultado = await tx.producto.updateMany({
            where: { id: item.productoId, stock: { gte: item.cantidad } },
            data: { stock: { decrement: item.cantidad } },
          });
          if (resultado.count === 0) {
            const actual = await tx.producto.findUnique({ where: { id: item.productoId } });
            throw new Error(
              `STOCK_INSUFICIENTE: ${actual?.nombre ?? "producto"} ya no tiene stock suficiente (disponible: ${actual?.stock ?? 0})`,
            );
          }
          await tx.movimientoInventario.create({
            data: {
              productoId: item.productoId,
              tipo: "VENTA",
              cantidad: item.cantidad,
              usuarioId: req.user!.id,
              ventaId: nueva.id,
            },
          });
          await consumirLotesFEFO(tx, item.productoId, item.cantidad);
        }

        if (metodoPago === "CREDITO" && cliente) {
          // Igual que con el stock: el cupo disponible se validó leyendo
          // ANTES de esta transacción, así que dos ventas fiadas concurrentes
          // del mismo cliente podrían pasar esa validación y juntas superar
          // el cupo. La guarda va en el propio UPDATE: solo se aplica el
          // cargo si en ese instante el saldo pendiente todavía cabe dentro
          // del cupo (limiteCredito no cambia en medio de una venta, así que
          // usar el valor ya leído para el límite es seguro).
          const cargo = await tx.cliente.updateMany({
            where: { id: cliente.id, saldoPendiente: { lte: cliente.limiteCredito - total } },
            data: { saldoPendiente: { increment: total } },
          });
          if (cargo.count === 0) {
            throw new Error(`CUPO_INSUFICIENTE: ${cliente.nombre} ya no tiene cupo de fiado suficiente para esta venta`);
          }
          const clienteActualizado = await tx.cliente.findUniqueOrThrow({ where: { id: cliente.id } });
          await tx.cuentaCorrienteMovimiento.create({
            data: {
              clienteId: cliente.id,
              tipo: "CARGO",
              monto: total,
              saldoResultante: clienteActualizado.saldoPendiente,
              ventaId: nueva.id,
              motivo: `Venta fiada #${nueva.prefijo}-${nueva.numero}`,
              usuarioId: req.user!.id,
            },
          });
        }

        return nueva;
    });
  } catch (err) {
    const mensaje = err instanceof Error ? err.message : "";
    if (mensaje.startsWith("STOCK_INSUFICIENTE:")) {
      return res.status(409).json({ error: mensaje.replace("STOCK_INSUFICIENTE: ", "") });
    }
    if (mensaje.startsWith("CUPO_INSUFICIENTE:")) {
      return res.status(409).json({ error: mensaje.replace("CUPO_INSUFICIENTE: ", "") });
    }
    throw err;
  }

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

  try {
    await prisma.$transaction(async (tx) => {
    // Guarda contra doble anulación concurrente (doble clic, o dos pestañas):
    // sin esto, dos solicitudes simultáneas podrían pasar el chequeo de
    // arriba y devolver el stock/saldo dos veces por la misma venta.
    const actualizacion = await tx.venta.updateMany({
      where: { id, estado: { not: "ANULADA" } },
      data: { estado: "ANULADA", motivoAnulacion: parsed.data.motivo },
    });
    if (actualizacion.count === 0) {
      throw new Error("La venta ya estaba anulada");
    }

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

    // Si era una venta fiada, se reversa la deuda que había generado en la
    // cuenta del cliente. Decremento atómico (no lectura+escritura) para no
    // pisar un abono o cargo concurrente sobre el mismo cliente.
    if (venta.metodoPago === "CREDITO" && venta.clienteId) {
      const clienteActualizado = await tx.cliente.update({
        where: { id: venta.clienteId },
        data: { saldoPendiente: { decrement: venta.total } },
      });
      await tx.cuentaCorrienteMovimiento.create({
        data: {
          clienteId: clienteActualizado.id,
          tipo: "AJUSTE",
          monto: -venta.total,
          saldoResultante: clienteActualizado.saldoPendiente,
          ventaId: venta.id,
          motivo: `Reversa por anulación de venta #${venta.prefijo}-${venta.numero}: ${parsed.data.motivo}`,
          usuarioId: req.user!.id,
        },
      });
    }
    });
  } catch (err) {
    if (err instanceof Error && err.message === "La venta ya estaba anulada") {
      return res.status(409).json({ error: err.message });
    }
    throw err;
  }

  res.status(204).send();
});

export default router;
