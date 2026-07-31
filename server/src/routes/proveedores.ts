import { Router } from "express";
import { z } from "zod";
import { prisma } from "../db";
import { requireAuth, requireRole } from "../middleware/auth";

const router = Router();
router.use(requireAuth);

router.get("/", async (_req, res) => {
  const proveedores = await prisma.proveedor.findMany({
    orderBy: { nombre: "asc" },
    include: { _count: { select: { productos: true } } },
  });
  res.json(proveedores);
});

const schema = z.object({
  nombre: z.string().trim().min(1).max(200),
  telefono: z.string().trim().max(50).nullish(),
  direccion: z.string().trim().max(300).nullish(),
  notas: z.string().trim().max(1000).nullish(),
});

router.post("/", requireRole("ADMIN"), async (req, res) => {
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  try {
    const proveedor = await prisma.proveedor.create({ data: parsed.data });
    res.status(201).json(proveedor);
  } catch {
    res.status(409).json({ error: "Ya existe un proveedor con ese nombre" });
  }
});

router.put("/:id", requireRole("ADMIN"), async (req, res) => {
  const parsed = schema.partial().safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  try {
    const proveedor = await prisma.proveedor.update({
      where: { id: Number(req.params.id) },
      data: parsed.data,
    });
    res.json(proveedor);
  } catch {
    res.status(409).json({ error: "No se pudo actualizar (nombre duplicado o proveedor inexistente)" });
  }
});

router.delete("/:id", requireRole("ADMIN"), async (req, res) => {
  const id = Number(req.params.id);
  const proveedor = await prisma.proveedor.findUnique({ where: { id } });
  if (!proveedor) return res.status(404).json({ error: "Proveedor no encontrado" });
  if (proveedor.saldoPendiente > 0) {
    return res.status(409).json({ error: "No se puede eliminar: todavía se le debe plata a este proveedor" });
  }
  const enUso = await prisma.producto.count({ where: { proveedorId: id } });
  if (enUso > 0) {
    return res.status(409).json({ error: "No se puede eliminar: hay productos con este proveedor" });
  }
  await prisma.proveedor.delete({ where: { id } });
  res.status(204).send();
});

// Estado de cuenta: historial de cargos (compras a crédito) y pagos hechos a
// este proveedor. Espejo de GET /clientes/:id/cuenta.
router.get("/:id/cuenta", async (req, res) => {
  const proveedorId = Number(req.params.id);
  const proveedor = await prisma.proveedor.findUnique({ where: { id: proveedorId } });
  if (!proveedor) return res.status(404).json({ error: "Proveedor no encontrado" });

  const movimientos = await prisma.movimientoCuentaProveedor.findMany({
    where: { proveedorId },
    include: { usuario: { select: { nombre: true } } },
    orderBy: { createdAt: "desc" },
    take: 200,
  });

  res.json({ proveedor, movimientos });
});

const cargoSchema = z.object({
  monto: z.number().positive().finite().max(1_000_000_000),
  motivo: z.string().trim().min(1).max(1000),
});

// Registrar una deuda con el proveedor: mercancía recibida que se paga
// después (compra a crédito), o cualquier otra cuenta pendiente con él.
router.post("/:id/cargos", requireRole("ADMIN"), async (req, res) => {
  const parsed = cargoSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  const proveedorId = Number(req.params.id);

  const proveedor = await prisma.proveedor.findUnique({ where: { id: proveedorId } });
  if (!proveedor) return res.status(404).json({ error: "Proveedor no encontrado" });

  const proveedorActualizado = await prisma.$transaction(async (tx) => {
    const actualizado = await tx.proveedor.update({
      where: { id: proveedorId },
      data: { saldoPendiente: { increment: parsed.data.monto } },
    });
    await tx.movimientoCuentaProveedor.create({
      data: {
        proveedorId,
        tipo: "CARGO",
        monto: parsed.data.monto,
        saldoResultante: actualizado.saldoPendiente,
        motivo: parsed.data.motivo,
        usuarioId: req.user!.id,
      },
    });
    return actualizado;
  });
  res.status(201).json(proveedorActualizado);
});

const pagoSchema = z.object({
  monto: z.number().positive().finite().max(1_000_000_000),
  motivo: z.string().trim().max(1000).optional(),
});

// Registrar un pago hecho al proveedor (total o parcial de lo que se le debe).
router.post("/:id/pagos", requireRole("ADMIN"), async (req, res) => {
  const parsed = pagoSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  const proveedorId = Number(req.params.id);

  const proveedor = await prisma.proveedor.findUnique({ where: { id: proveedorId } });
  if (!proveedor) return res.status(404).json({ error: "Proveedor no encontrado" });
  if (parsed.data.monto > proveedor.saldoPendiente) {
    return res.status(400).json({
      error: `El pago ($${parsed.data.monto}) es mayor que la deuda actual ($${proveedor.saldoPendiente})`,
    });
  }

  try {
    const proveedorActualizado = await prisma.$transaction(async (tx) => {
      const actualizacion = await tx.proveedor.updateMany({
        where: { id: proveedorId, saldoPendiente: { gte: parsed.data.monto } },
        data: { saldoPendiente: { decrement: parsed.data.monto } },
      });
      if (actualizacion.count === 0) {
        throw new Error("El pago es mayor que la deuda actual");
      }
      const actualizado = await tx.proveedor.findUniqueOrThrow({ where: { id: proveedorId } });
      await tx.movimientoCuentaProveedor.create({
        data: {
          proveedorId,
          tipo: "ABONO",
          monto: parsed.data.monto,
          saldoResultante: actualizado.saldoPendiente,
          motivo: parsed.data.motivo,
          usuarioId: req.user!.id,
        },
      });
      return actualizado;
    });
    res.status(201).json(proveedorActualizado);
  } catch (err) {
    if (err instanceof Error && err.message === "El pago es mayor que la deuda actual") {
      return res.status(409).json({ error: err.message });
    }
    throw err;
  }
});

export default router;
