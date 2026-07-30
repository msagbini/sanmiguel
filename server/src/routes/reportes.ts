import { Router } from "express";
import { prisma } from "../db";
import { requireAuth } from "../middleware/auth";

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
      const costo = item.producto.precioCosto * item.cantidad;
      ganancia += base - costo;
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
    const actual = porProducto.get(item.productoId) ?? {
      productoId: item.productoId,
      nombre: item.nombreProducto,
      cantidad: 0,
      total: 0,
    };
    actual.cantidad += item.cantidad;
    actual.total += item.subtotal;
    porProducto.set(item.productoId, actual);
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

export default router;
