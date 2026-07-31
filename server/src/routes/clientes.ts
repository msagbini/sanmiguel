import { Router } from "express";
import { z } from "zod";
import { prisma } from "../db";
import { requireAuth, requireRole } from "../middleware/auth";
import { TIPOS_DOCUMENTO_CLIENTE, TIPOS_CLIENTE } from "../constants";
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
    const cliente = await prisma.cliente.create({
      data: {
        ...parsed.data,
        esConsumidorFinal: false,
        limiteCredito: parsed.data.limiteCredito ?? config.limiteCreditoPorDefecto,
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
  const cliente = await prisma.cliente.update({
    where: { id: Number(req.params.id) },
    data: parsed.data,
  });
  res.json(cliente);
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

  const nuevoSaldo = cliente.saldoPendiente - parsed.data.monto;
  const turnoAbierto = await prisma.turno.findFirst({ where: { cerradoEn: null } });
  const [clienteActualizado] = await prisma.$transaction([
    prisma.cliente.update({ where: { id: clienteId }, data: { saldoPendiente: nuevoSaldo } }),
    prisma.cuentaCorrienteMovimiento.create({
      data: {
        clienteId,
        tipo: "ABONO",
        monto: parsed.data.monto,
        saldoResultante: nuevoSaldo,
        metodoPago: parsed.data.metodoPago,
        motivo: parsed.data.motivo,
        usuarioId: req.user!.id,
        turnoId: turnoAbierto?.id ?? null,
      },
    }),
  ]);

  res.status(201).json(clienteActualizado);
});

export default router;
