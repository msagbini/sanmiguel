import { Router } from "express";
import { z } from "zod";
import { prisma } from "../db";
import { requireAuth } from "../middleware/auth";
import { TIPOS_DOCUMENTO_CLIENTE } from "../constants";

const router = Router();
router.use(requireAuth);

router.get("/", async (req, res) => {
  const { buscar } = req.query;
  const where: Record<string, unknown> = {};
  if (buscar) {
    where.OR = [
      { nombre: { contains: String(buscar) } },
      { numeroDocumento: { contains: String(buscar) } },
    ];
  }
  const clientes = await prisma.cliente.findMany({ where, orderBy: { nombre: "asc" }, take: 100 });
  res.json(clientes);
});

const schema = z.object({
  tipoDocumento: z.enum(TIPOS_DOCUMENTO_CLIENTE),
  numeroDocumento: z.string().min(1),
  nombre: z.string().min(1),
  telefono: z.string().nullish(),
  email: z.string().email().nullish().or(z.literal("")),
  direccion: z.string().nullish(),
});

router.post("/", async (req, res) => {
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  try {
    const cliente = await prisma.cliente.create({
      data: { ...parsed.data, esConsumidorFinal: false },
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

export default router;
