import { Router } from "express";
import { z } from "zod";
import { prisma } from "../db";
import { requireAuth } from "../middleware/auth";

const router = Router();
router.use(requireAuth);

async function calcularResumen(turnoId: number) {
  const turno = await prisma.turno.findUniqueOrThrow({ where: { id: turnoId } });

  const [ventasEfectivo, abonosEfectivo, numeroVentas] = await Promise.all([
    prisma.venta.aggregate({
      where: { turnoId, estado: "COMPLETADA", metodoPago: "EFECTIVO" },
      _sum: { total: true },
    }),
    prisma.cuentaCorrienteMovimiento.aggregate({
      where: { turnoId, tipo: "ABONO", metodoPago: "EFECTIVO" },
      _sum: { monto: true },
    }),
    prisma.venta.count({ where: { turnoId, estado: "COMPLETADA" } }),
  ]);

  const totalVentasEfectivo = ventasEfectivo._sum.total ?? 0;
  const totalAbonosEfectivo = abonosEfectivo._sum.monto ?? 0;
  const efectivoEsperado = turno.fondoInicial + totalVentasEfectivo + totalAbonosEfectivo;

  return { turno, totalVentasEfectivo, totalAbonosEfectivo, efectivoEsperado, numeroVentas };
}

router.get("/actual", async (_req, res) => {
  const turno = await prisma.turno.findFirst({
    where: { cerradoEn: null },
    include: { usuario: { select: { nombre: true } } },
  });
  if (!turno) return res.json(null);
  const resumen = await calcularResumen(turno.id);
  res.json(resumen);
});

router.get("/", async (_req, res) => {
  const turnos = await prisma.turno.findMany({
    include: { usuario: { select: { nombre: true } } },
    orderBy: { abiertoEn: "desc" },
    take: 30,
  });
  res.json(turnos);
});

const abrirSchema = z.object({ fondoInicial: z.number().min(0) });

router.post("/abrir", async (req, res) => {
  const parsed = abrirSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

  const abierto = await prisma.turno.findFirst({ where: { cerradoEn: null } });
  if (abierto) return res.status(409).json({ error: "Ya hay un turno de caja abierto" });

  const turno = await prisma.turno.create({
    data: { usuarioId: req.user!.id, fondoInicial: parsed.data.fondoInicial },
  });
  res.status(201).json(turno);
});

const cerrarSchema = z.object({ efectivoContado: z.number().min(0), notas: z.string().optional() });

router.post("/:id/cerrar", async (req, res) => {
  const parsed = cerrarSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  const id = Number(req.params.id);

  const turno = await prisma.turno.findUnique({ where: { id } });
  if (!turno) return res.status(404).json({ error: "Turno no encontrado" });
  if (turno.cerradoEn) return res.status(400).json({ error: "Ese turno ya está cerrado" });
  if (turno.usuarioId !== req.user!.id && req.user!.rol !== "ADMIN") {
    return res.status(403).json({ error: "Solo quien abrió el turno o un administrador puede cerrarlo" });
  }

  const { efectivoEsperado } = await calcularResumen(id);
  const diferencia = parsed.data.efectivoContado - efectivoEsperado;

  const actualizado = await prisma.turno.update({
    where: { id },
    data: {
      cerradoEn: new Date(),
      efectivoContado: parsed.data.efectivoContado,
      efectivoEsperado,
      diferencia,
      notas: parsed.data.notas,
    },
  });

  res.json(actualizado);
});

router.get("/:id/resumen", async (req, res) => {
  const resumen = await calcularResumen(Number(req.params.id));
  res.json(resumen);
});

export default router;
