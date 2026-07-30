import { Router } from "express";
import { z } from "zod";
import { prisma } from "../db";
import { requireAuth, requireRole } from "../middleware/auth";

const router = Router();
router.use(requireAuth);

router.get("/", async (_req, res) => {
  const categorias = await prisma.categoria.findMany({
    orderBy: { nombre: "asc" },
    include: { _count: { select: { productos: true } } },
  });
  res.json(categorias);
});

const schema = z.object({ nombre: z.string().min(1) });

router.post("/", requireRole("ADMIN"), async (req, res) => {
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  try {
    const categoria = await prisma.categoria.create({ data: parsed.data });
    res.status(201).json(categoria);
  } catch {
    res.status(409).json({ error: "Ya existe una categoría con ese nombre" });
  }
});

router.put("/:id", requireRole("ADMIN"), async (req, res) => {
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  const categoria = await prisma.categoria.update({
    where: { id: Number(req.params.id) },
    data: parsed.data,
  });
  res.json(categoria);
});

router.delete("/:id", requireRole("ADMIN"), async (req, res) => {
  const id = Number(req.params.id);
  const enUso = await prisma.producto.count({ where: { categoriaId: id } });
  if (enUso > 0) {
    return res.status(409).json({ error: "No se puede eliminar: hay productos en esta categoría" });
  }
  await prisma.categoria.delete({ where: { id } });
  res.status(204).send();
});

export default router;
