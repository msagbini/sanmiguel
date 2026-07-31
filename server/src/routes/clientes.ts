import { Router } from "express";
import { z } from "zod";
import { prisma } from "../db";
import { requireAuth, requireRole } from "../middleware/auth";
import {
  TIPOS_DOCUMENTO_CLIENTE,
  TIPOS_CLIENTE,
  TIPOS_REFERENCIA,
  MINIMO_CODEUDORES,
  MINIMO_REFERENCIAS,
} from "../constants";
import { calcularDiasVencido } from "../services/cartera";

const router = Router();
router.use(requireAuth);

router.get("/", async (req, res) => {
  const { buscar, conSaldo } = req.query;
  const where: Record<string, unknown> = {};
  if (buscar) {
    where.OR = [
      { nombre: { contains: String(buscar) } },
      { numeroDocumento: { contains: String(buscar) } },
    ];
  }
  let clientes = await prisma.cliente.findMany({ where, orderBy: { nombre: "asc" }, take: 200 });
  if (conSaldo === "true") clientes = clientes.filter((c) => c.saldoPendiente > 0);
  res.json(clientes);
});

const schema = z.object({
  tipoDocumento: z.enum(TIPOS_DOCUMENTO_CLIENTE),
  numeroDocumento: z.string().min(1),
  nombre: z.string().min(1),
  telefono: z.string().nullish(),
  email: z.string().email().nullish().or(z.literal("")),
  direccion: z.string().nullish(),
  tipoCliente: z.enum(TIPOS_CLIENTE).optional(),
  limiteCredito: z.number().min(0).optional(),
  diasPlazoCredito: z.number().int().min(1).optional(),
});

router.post("/", async (req, res) => {
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  try {
    const config = await prisma.configuracion.upsert({ where: { id: 1 }, update: {}, create: {} });
    // Un cliente nuevo nunca puede nacer con cupo de fiado: el estudio de
    // crédito (codeudores + referencias + aprobación) todavía no existe.
    const cliente = await prisma.cliente.create({
      data: {
        ...parsed.data,
        esConsumidorFinal: false,
        limiteCredito: 0,
        diasPlazoCredito: parsed.data.diasPlazoCredito ?? config.diasPlazoCreditoPorDefecto,
      },
    });
    res.status(201).json(cliente);
  } catch {
    res.status(409).json({ error: "Ya existe un cliente con ese documento" });
  }
});

router.put("/:id", async (req, res) => {
  const parsed = schema.partial().safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  const clienteId = Number(req.params.id);

  if (parsed.data.limiteCredito !== undefined && parsed.data.limiteCredito > 0) {
    const actual = await prisma.cliente.findUnique({ where: { id: clienteId } });
    if (!actual) return res.status(404).json({ error: "Cliente no encontrado" });
    if (!actual.estudioCreditoAprobado) {
      return res.status(400).json({
        error:
          "No se puede asignar cupo de fiado sin un estudio de crédito aprobado " +
          `(mínimo ${MINIMO_CODEUDORES} codeudores y ${MINIMO_REFERENCIAS} referencias, aprobado por un administrador).`,
      });
    }
  }

  const cliente = await prisma.cliente.update({
    where: { id: clienteId },
    data: parsed.data,
  });
  res.json(cliente);
});

router.get("/:id", async (req, res) => {
  const cliente = await prisma.cliente.findUnique({
    where: { id: Number(req.params.id) },
    include: { codeudores: true, referencias: true },
  });
  if (!cliente) return res.status(404).json({ error: "Cliente no encontrado" });
  res.json(cliente);
});

const codeudorSchema = z.object({
  nombre: z.string().min(1),
  tipoDocumento: z.enum(TIPOS_DOCUMENTO_CLIENTE).optional(),
  numeroDocumento: z.string().min(1),
  telefono: z.string().min(1),
  direccion: z.string().nullish(),
  parentesco: z.string().nullish(),
});

router.post("/:id/codeudores", requireRole("ADMIN"), async (req, res) => {
  const parsed = codeudorSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  const clienteId = Number(req.params.id);
  const cliente = await prisma.cliente.findUnique({ where: { id: clienteId } });
  if (!cliente) return res.status(404).json({ error: "Cliente no encontrado" });
  const codeudor = await prisma.codeudor.create({ data: { ...parsed.data, clienteId } });
  res.status(201).json(codeudor);
});

router.delete("/:id/codeudores/:codeudorId", requireRole("ADMIN"), async (req, res) => {
  const clienteId = Number(req.params.id);
  await prisma.codeudor.delete({ where: { id: Number(req.params.codeudorId) } });
  await revocarSiYaNoCalifica(clienteId);
  res.status(204).end();
});

const referenciaSchema = z.object({
  tipo: z.enum(TIPOS_REFERENCIA).optional(),
  nombre: z.string().min(1),
  telefono: z.string().min(1),
  relacion: z.string().nullish(),
});

router.post("/:id/referencias", requireRole("ADMIN"), async (req, res) => {
  const parsed = referenciaSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  const clienteId = Number(req.params.id);
  const cliente = await prisma.cliente.findUnique({ where: { id: clienteId } });
  if (!cliente) return res.status(404).json({ error: "Cliente no encontrado" });
  const referencia = await prisma.referenciaCliente.create({ data: { ...parsed.data, clienteId } });
  res.status(201).json(referencia);
});

router.delete("/:id/referencias/:referenciaId", requireRole("ADMIN"), async (req, res) => {
  const clienteId = Number(req.params.id);
  await prisma.referenciaCliente.delete({ where: { id: Number(req.params.referenciaId) } });
  await revocarSiYaNoCalifica(clienteId);
  res.status(204).end();
});

// Si tras borrar un codeudor/referencia el cliente queda por debajo del
// mínimo exigido, se revoca la aprobación y se anula el cupo de fiado. Evita
// que alguien apruebe el estudio y luego borre codeudores para debilitarlo
// sin que el sistema se entere.
async function revocarSiYaNoCalifica(clienteId: number) {
  const cliente = await prisma.cliente.findUnique({ where: { id: clienteId } });
  if (!cliente || !cliente.estudioCreditoAprobado) return;
  const [codeudores, referencias] = await Promise.all([
    prisma.codeudor.count({ where: { clienteId } }),
    prisma.referenciaCliente.count({ where: { clienteId } }),
  ]);
  if (codeudores < MINIMO_CODEUDORES || referencias < MINIMO_REFERENCIAS) {
    await prisma.cliente.update({
      where: { id: clienteId },
      data: {
        estudioCreditoAprobado: false,
        estudioCreditoAprobadoPorId: null,
        estudioCreditoAprobadoEn: null,
        limiteCredito: 0,
      },
    });
  }
}

const estudioAprobarSchema = z.object({
  notas: z.string().nullish(),
});

router.post("/:id/estudio-credito/aprobar", requireRole("ADMIN"), async (req, res) => {
  const parsed = estudioAprobarSchema.safeParse(req.body ?? {});
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  const clienteId = Number(req.params.id);
  const [cliente, codeudores, referencias] = await Promise.all([
    prisma.cliente.findUnique({ where: { id: clienteId } }),
    prisma.codeudor.count({ where: { clienteId } }),
    prisma.referenciaCliente.count({ where: { clienteId } }),
  ]);
  if (!cliente) return res.status(404).json({ error: "Cliente no encontrado" });
  if (codeudores < MINIMO_CODEUDORES) {
    return res.status(400).json({
      error: `Faltan codeudores: hay ${codeudores}, se necesitan mínimo ${MINIMO_CODEUDORES}.`,
    });
  }
  if (referencias < MINIMO_REFERENCIAS) {
    return res.status(400).json({
      error: `Faltan referencias: hay ${referencias}, se necesitan mínimo ${MINIMO_REFERENCIAS}.`,
    });
  }
  const actualizado = await prisma.cliente.update({
    where: { id: clienteId },
    data: {
      estudioCreditoAprobado: true,
      estudioCreditoAprobadoPorId: req.user!.id,
      estudioCreditoAprobadoEn: new Date(),
      estudioCreditoNotas: parsed.data.notas ?? cliente.estudioCreditoNotas,
    },
  });
  res.json(actualizado);
});

router.post("/:id/estudio-credito/revocar", requireRole("ADMIN"), async (req, res) => {
  const clienteId = Number(req.params.id);
  const cliente = await prisma.cliente.findUnique({ where: { id: clienteId } });
  if (!cliente) return res.status(404).json({ error: "Cliente no encontrado" });
  const actualizado = await prisma.cliente.update({
    where: { id: clienteId },
    data: {
      estudioCreditoAprobado: false,
      estudioCreditoAprobadoPorId: null,
      estudioCreditoAprobadoEn: null,
      limiteCredito: 0,
    },
  });
  res.json(actualizado);
});

// Estado de cuenta: historial de cargos/abonos y qué tan vencida está la
// deuda (FIFO: los abonos se van aplicando primero a las ventas fiadas más
// antiguas para saber desde cuándo se debe la porción de saldo que queda).
router.get("/:id/cuenta", async (req, res) => {
  const clienteId = Number(req.params.id);
  const cliente = await prisma.cliente.findUnique({ where: { id: clienteId } });
  if (!cliente) return res.status(404).json({ error: "Cliente no encontrado" });

  const [movimientos, ventasCredito] = await Promise.all([
    prisma.cuentaCorrienteMovimiento.findMany({
      where: { clienteId },
      include: { usuario: { select: { nombre: true } } },
      orderBy: { createdAt: "desc" },
      take: 200,
    }),
    prisma.venta.findMany({
      where: { clienteId, metodoPago: "CREDITO", estado: "COMPLETADA" },
      orderBy: { createdAt: "asc" },
    }),
  ]);

  const totalAbonos = movimientos
    .filter((m) => m.tipo === "ABONO")
    .reduce((acc, m) => acc + m.monto, 0);

  const diasVencido =
    cliente.saldoPendiente > 0
      ? calcularDiasVencido(ventasCredito, totalAbonos, cliente.diasPlazoCredito)
      : 0;

  res.json({ cliente, movimientos, ventasCredito, diasVencido });
});

const abonoSchema = z.object({
  monto: z.number().positive(),
  metodoPago: z.string().default("EFECTIVO"),
  motivo: z.string().optional(),
});

// Registrar un abono (pago) del cliente a su cuenta de fiado.
router.post("/:id/abonos", async (req, res) => {
  const parsed = abonoSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  const clienteId = Number(req.params.id);

  const cliente = await prisma.cliente.findUnique({ where: { id: clienteId } });
  if (!cliente) return res.status(404).json({ error: "Cliente no encontrado" });
  if (parsed.data.monto > cliente.saldoPendiente) {
    return res.status(400).json({
      error: `El abono ($${parsed.data.monto}) es mayor que la deuda actual ($${cliente.saldoPendiente})`,
    });
  }

  const turnoAbierto = await prisma.turno.findFirst({ where: { cerradoEn: null } });
  try {
    const clienteActualizado = await prisma.$transaction(async (tx) => {
      // Guarda atómica: si dos abonos (o un abono y una venta fiada) llegan
      // al mismo tiempo, esto evita que el saldo termine negativo por una
      // resta calculada sobre un valor que ya quedó desactualizado.
      const actualizacion = await tx.cliente.updateMany({
        where: { id: clienteId, saldoPendiente: { gte: parsed.data.monto } },
        data: { saldoPendiente: { decrement: parsed.data.monto } },
      });
      if (actualizacion.count === 0) {
        throw new Error("El abono es mayor que la deuda actual");
      }
      const actualizado = await tx.cliente.findUniqueOrThrow({ where: { id: clienteId } });
      await tx.cuentaCorrienteMovimiento.create({
        data: {
          clienteId,
          tipo: "ABONO",
          monto: parsed.data.monto,
          saldoResultante: actualizado.saldoPendiente,
          metodoPago: parsed.data.metodoPago,
          motivo: parsed.data.motivo,
          usuarioId: req.user!.id,
          turnoId: turnoAbierto?.id ?? null,
        },
      });
      return actualizado;
    });
    res.status(201).json(clienteActualizado);
  } catch (err) {
    if (err instanceof Error && err.message === "El abono es mayor que la deuda actual") {
      return res.status(409).json({ error: err.message });
    }
    throw err;
  }
});

export default router;
