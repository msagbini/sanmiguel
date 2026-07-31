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
  const enUso = await prisma.producto.count({ where: { proveedorId: id } });
  if (enUso > 0) {
    return res.status(409).json({ error: "No se puede eliminar: hay productos con este proveedor" });
  }
  await prisma.proveedor.delete({ where: { id } });
  res.status(204).send();
});

export default router;
