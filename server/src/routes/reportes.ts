import { Router } from "express";
import { prisma } from "../db";
import { requireAuth } from "../middleware/auth";
import { calcularDiasVencido } from "../services/cartera";

const router = Router();
router.use(requireAuth);

function rangoFechas(req: import("express").Request) {
  const { desde, hasta } = req.query;
  const inicio = desde ? new Date(String(desde)) : new Date(new Date().setHours(0, 0, 0, 0));
  const fin = hasta ? new Date(String(hasta)) : new Date();
  return { inicio, fin };
}

router.get("/resumen", async (req, res) => {
  const { inicio, fin } = rangoFechas(req);

  const ventas = await prisma.venta.findMany({
    where: { createdAt: { gte: inicio, lte: fin }, estado: "COMPLETADA" },
    include: { items: { include: { producto: true } } },
  });

  let totalVentas = 0;
  let totalIva = 0;
  let ganancia = 0;
  let unidadesVendidas = 0;

  for (const venta of ventas) {
    totalVentas += venta.total;
    totalIva += venta.ivaTotal;
    for (const item of venta.items) {
      const base = item.subtotal / (1 + item.ivaTasa / 100);
      const costoUnitario = item.producto?.precioCosto ?? item.costoUnitarioLibre ?? 0;
      ganancia += base - costoUnitario * item.cantidad;
      unidadesVendidas += item.cantidad;
    }
  }

  res.json({
    numeroVentas: ventas.length,
    totalVentas,
    totalIva,
    ganancia,
    unidadesVendidas,
    ticketPromedio: ventas.length ? totalVentas / ventas.length : 0,
  });
});

router.get("/top-productos", async (req, res) => {
  const { inicio, fin } = rangoFechas(req);
  const limit = Number(req.query.limit ?? 10);

  const items = await prisma.ventaItem.findMany({
    where: { venta: { createdAt: { gte: inicio, lte: fin }, estado: "COMPLETADA" } },
    include: { producto: true },
  });

  const porProducto = new Map<
    number,
    { productoId: number; nombre: string; cantidad: number; total: number }
  >();

  for (const item of items) {
    const clave = item.productoId ?? -item.id; // los productos libres no agrupan entre sí
    const actual = porProducto.get(clave) ?? {
      productoId: clave,
      nombre: item.nombreProducto,
      cantidad: 0,
      total: 0,
    };
    actual.cantidad += item.cantidad;
    actual.total += item.subtotal;
    porProducto.set(clave, actual);
  }

  const top = [...porProducto.values()].sort((a, b) => b.cantidad - a.cantidad).slice(0, limit);
  res.json(top);
});

router.get("/ventas-por-dia", async (req, res) => {
  const { inicio, fin } = rangoFechas(req);
  const ventas = await prisma.venta.findMany({
    where: { createdAt: { gte: inicio, lte: fin }, estado: "COMPLETADA" },
    select: { createdAt: true, total: true },
  });

  const porDia = new Map<string, number>();
  for (const venta of ventas) {
    const dia = venta.createdAt.toISOString().slice(0, 10);
    porDia.set(dia, (porDia.get(dia) ?? 0) + venta.total);
  }

  const resultado = [...porDia.entries()]
    .map(([fecha, total]) => ({ fecha, total }))
    .sort((a, b) => a.fecha.localeCompare(b.fecha));
  res.json(resultado);
});

router.get("/stock-bajo", async (_req, res) => {
  const productos = await prisma.producto.findMany({ where: { activo: true } });
  const bajos = productos.filter((p) => p.stock <= p.stockMinimo);
  res.json(bajos);
});

// Cartera (fiado): panorama general de cuánto deben los clientes y quién está vencido.
router.get("/cartera", async (_req, res) => {
  const config = await prisma.configuracion.upsert({ where: { id: 1 }, update: {}, create: {} });
  const clientes = await prisma.cliente.findMany({ where: { saldoPendiente: { gt: 0 } } });

  let totalCartera = 0;
  let totalVencido = 0;
  const detalle: { clienteId: number; nombre: string; telefono: string | null; saldoPendiente: number; diasVencido: number }[] = [];

  for (const cliente of clientes) {
    totalCartera += cliente.saldoPendiente;

    const [abonos, ventasCredito] = await Promise.all([
      prisma.cuentaCorrienteMovimiento.aggregate({
        where: { clienteId: cliente.id, tipo: "ABONO" },
        _sum: { monto: true },
      }),
      prisma.venta.findMany({
        where: { clienteId: cliente.id, metodoPago: "CREDITO", estado: "COMPLETADA" },
        orderBy: { createdAt: "asc" },
        select: { total: true, createdAt: true },
      }),
    ]);

    const diasVencido = calcularDiasVencido(ventasCredito, abonos._sum.monto ?? 0, cliente.diasPlazoCredito);

    if (diasVencido > 0) totalVencido += cliente.saldoPendiente;
    detalle.push({
      clienteId: cliente.id,
      nombre: cliente.nombre,
      telefono: cliente.telefono,
      saldoPendiente: cliente.saldoPendiente,
      diasVencido,
    });
  }

  detalle.sort((a, b) => b.diasVencido - a.diasVencido || b.saldoPendiente - a.saldoPendiente);

  res.json({
    totalCartera,
    totalVencido,
    numeroClientes: clientes.length,
    diasParaVencido: config.diasParaVencido,
    clientes: detalle,
  });
});

// Resumen de cuentas por pagar: espejo de /cartera pero de lo que el
// negocio le debe a sus proveedores, no de lo que le deben a él.
router.get("/cuentas-por-pagar", async (_req, res) => {
  const proveedores = await prisma.proveedor.findMany({
    where: { saldoPendiente: { gt: 0 } },
    orderBy: { saldoPendiente: "desc" },
  });
  const total = proveedores.reduce((acc, p) => acc + p.saldoPendiente, 0);
  res.json({
    total,
    numeroProveedores: proveedores.length,
    proveedores: proveedores.map((p) => ({
      proveedorId: p.id,
      nombre: p.nombre,
      telefono: p.telefono,
      saldoPendiente: p.saldoPendiente,
    })),
  });
});

export default router;
