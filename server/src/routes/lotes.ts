import { Router } from "express";
import { z } from "zod";
import { prisma } from "../db";
import { requireAuth, requireRole } from "../middleware/auth";

const router = Router();
router.use(requireAuth);

// Lotes con vencimiento próximo o ya vencido, para el panel de Inventario.
router.get("/", async (req, res) => {
  const config = await prisma.configuracion.upsert({ where: { id: 1 }, update: {}, create: {} });
  const dias = req.query.dias ? Number(req.query.dias) : config.diasAlertaVencimiento;
  const limite = new Date();
  limite.setDate(limite.getDate() + dias);

  const lotes = await prisma.loteInventario.findMany({
    where: { activo: true, cantidadDisponible: { gt: 0 }, fechaVencimiento: { not: null, lte: limite } },
    include: { producto: { select: { nombre: true, unidad: true, codigoBarras: true } } },
    orderBy: { fechaVencimiento: "asc" },
  });

  const hoy = new Date();
  const resultado = lotes.map((lote) => ({
    ...lote,
    vencido: lote.fechaVencimiento != null && lote.fechaVencimiento < hoy,
  }));

  res.json(resultado);
});

router.get("/resumen", async (req, res) => {
  const config = await prisma.configuracion.upsert({ where: { id: 1 }, update: {}, create: {} });
  const dias = req.query.dias ? Number(req.query.dias) : config.diasAlertaVencimiento;
  const limite = new Date();
  limite.setDate(limite.getDate() + dias);
  const hoy = new Date();

  const [porVencer, vencidos] = await Promise.all([
    prisma.loteInventario.count({
      where: { activo: true, cantidadDisponible: { gt: 0 }, fechaVencimiento: { gte: hoy, lte: limite } },
    }),
    prisma.loteInventario.count({
      where: { activo: true, cantidadDisponible: { gt: 0 }, fechaVencimiento: { lt: hoy } },
    }),
  ]);

  res.json({ porVencer, vencidos });
});

const darDeBajaSchema = z.object({ motivo: z.string().trim().min(1).max(1000) });

// Da de baja lo que quede de un lote (vencido o dañado): genera una SALIDA de
// inventario y deja el lote en cero para que no vuelva a aparecer en las alertas.
router.post("/:id/dar-de-baja", requireRole("ADMIN"), async (req, res) => {
  const parsed = darDeBajaSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  const id = Number(req.params.id);

  const lote = await prisma.loteInventario.findUnique({ where: { id } });
  if (!lote) return res.status(404).json({ error: "Lote no encontrado" });
  if (lote.cantidadDisponible <= 0) return res.status(400).json({ error: "Este lote ya está en cero" });

  await prisma.$transaction([
    prisma.producto.update({
      where: { id: lote.productoId },
      data: { stock: { decrement: lote.cantidadDisponible } },
    }),
    prisma.movimientoInventario.create({
      data: {
        productoId: lote.productoId,
        tipo: "SALIDA",
        cantidad: lote.cantidadDisponible,
        motivo: `Baja de lote vencido/dañado: ${parsed.data.motivo}`,
        usuarioId: req.user!.id,
      },
    }),
    prisma.loteInventario.update({
      where: { id },
      data: { cantidadDisponible: 0, activo: false },
    }),
  ]);

  res.status(204).send();
});

export default router;
