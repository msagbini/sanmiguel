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
  numeroDocumento: z.string().trim().min(1).max(50),
  nombre: z.string().trim().min(1).max(200),
  telefono: z.string().max(50).nullish(),
  email: z.string().email().max(254).nullish().or(z.literal("")),
  direccion: z.string().max(300).nullish(),
  tipoCliente: z.enum(TIPOS_CLIENTE).optional(),
  limiteCredito: z.number().min(0).finite().max(1_000_000_000).optional(),
  diasPlazoCredito: z.number().int().min(1).max(3650).optional(),
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

  if (parsed.data.limiteCredito !== undefined) {
    // Cambiar el cupo de fiado es una decisión de crédito, no un dato de
    // contacto: solo un ADMIN puede hacerlo, y solo si el estudio de crédito
    // ya está aprobado. Sin este chequeo de rol, un CAJERO autenticado podía
    // subir el cupo de un cliente ya aprobado a cualquier monto llamando
    // directamente esta ruta.
    if (req.user!.rol !== "ADMIN") {
      return res.status(403).json({ error: "Solo un administrador puede cambiar el cupo de fiado" });
    }
    if (parsed.data.limiteCredito > 0) {
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
  nombre: z.string().trim().min(1).max(200),
  tipoDocumento: z.enum(TIPOS_DOCUMENTO_CLIENTE).optional(),
  numeroDocumento: z.string().trim().min(1).max(50),
  telefono: z.string().trim().min(1).max(50),
  direccion: z.string().max(300).nullish(),
  parentesco: z.string().max(100).nullish(),
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
  // Filtrar también por clienteId (no solo por el id del codeudor): sin esto,
  // la URL de un cliente permitiría borrar el codeudor de otro cliente
  // distinto con solo cambiar el id en la ruta.
  const { count } = await prisma.codeudor.deleteMany({ where: { id: Number(req.params.codeudorId), clienteId } });
  if (count === 0) return res.status(404).json({ error: "Codeudor no encontrado para este cliente" });
  await revocarSiYaNoCalifica(clienteId);
  res.status(204).end();
});

const referenciaSchema = z.object({
  tipo: z.enum(TIPOS_REFERENCIA).optional(),
  nombre: z.string().trim().min(1).max(200),
  telefono: z.string().trim().min(1).max(50),
  relacion: z.string().max(100).nullish(),
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
  const { count } = await prisma.referenciaCliente.deleteMany({
    where: { id: Number(req.params.referenciaId), clienteId },
  });
  if (count === 0) return res.status(404).json({ error: "Referencia no encontrada para este cliente" });
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
  notas: z.string().max(2000).nullish(),
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
  monto: z.number().positive().finite().max(1_000_000_000),
  metodoPago: z.string().max(50).default("EFECTIVO"),
  motivo: z.string().max(1000).optional(),
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

const ajusteSaldoSchema = z.object({
  // Positivo = aumenta la deuda (ej. registrar lo que ya debía antes de usar
  // la app); negativo = la reduce (corrección, condonación parcial, etc.).
  monto: z.number().finite().refine((v) => v !== 0, { message: "El monto no puede ser 0" }).refine((v) => Math.abs(v) <= 1_000_000_000, {
    message: "Monto fuera de rango",
  }),
  motivo: z.string().trim().min(1).max(1000),
});

// Ajuste manual del saldo de un cliente: para dejar registrada una deuda que
// ya existía antes de usar la app (o corregir un error), sin que eso pase
// por una venta ni requiera el estudio de crédito completo — es solo dejar
// constancia de una plata que ya se debe en la vida real, no está abriendo
// cupo de fiado nuevo (limiteCredito no cambia con esto).
router.post("/:id/ajustes", requireRole("ADMIN"), async (req, res) => {
  const parsed = ajusteSaldoSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  const clienteId = Number(req.params.id);
  const { monto, motivo } = parsed.data;

  const cliente = await prisma.cliente.findUnique({ where: { id: clienteId } });
  if (!cliente) return res.status(404).json({ error: "Cliente no encontrado" });

  try {
    const clienteActualizado = await prisma.$transaction(async (tx) => {
      // Guarda atómica (mismo patrón que abonos): evita que este ajuste y una
      // venta/abono concurrentes calculen el resultado sobre un saldo que ya
      // quedó desactualizado.
      const actualizacion = await tx.cliente.updateMany({
        where: { id: clienteId, saldoPendiente: { gte: -monto } },
        data: { saldoPendiente: { increment: monto } },
      });
      if (actualizacion.count === 0) {
        throw new Error("El ajuste dejaría el saldo del cliente en negativo");
      }
      const actualizado = await tx.cliente.findUniqueOrThrow({ where: { id: clienteId } });
      await tx.cuentaCorrienteMovimiento.create({
        data: {
          clienteId,
          tipo: "AJUSTE",
          monto,
          saldoResultante: actualizado.saldoPendiente,
          motivo,
          usuarioId: req.user!.id,
        },
      });
      return actualizado;
    });
    res.status(201).json(clienteActualizado);
  } catch (err) {
    if (err instanceof Error && err.message === "El ajuste dejaría el saldo del cliente en negativo") {
      return res.status(409).json({ error: err.message });
    }
    throw err;
  }
});

export default router;
