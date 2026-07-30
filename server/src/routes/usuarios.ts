import { Router } from "express";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { prisma } from "../db";
import { requireAuth, requireRole } from "../middleware/auth";
import { ROLES } from "../constants";

const router = Router();
router.use(requireAuth, requireRole("ADMIN"));

router.get("/", async (_req, res) => {
  const usuarios = await prisma.usuario.findMany({
    select: { id: true, nombre: true, email: true, rol: true, activo: true, createdAt: true },
    orderBy: { nombre: "asc" },
  });
  res.json(usuarios);
});

const crearSchema = z.object({
  nombre: z.string().min(1),
  email: z.string().email(),
  password: z.string().min(6),
  rol: z.enum(ROLES),
});

router.post("/", async (req, res) => {
  const parsed = crearSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  const { nombre, email, password, rol } = parsed.data;

  const existente = await prisma.usuario.findUnique({ where: { email } });
  if (existente) return res.status(409).json({ error: "Ya existe un usuario con ese email" });

  const passwordHash = await bcrypt.hash(password, 10);
  const usuario = await prisma.usuario.create({
    data: { nombre, email, passwordHash, rol },
    select: { id: true, nombre: true, email: true, rol: true, activo: true },
  });
  res.status(201).json(usuario);
});

const actualizarSchema = z.object({
  nombre: z.string().min(1).optional(),
  rol: z.enum(ROLES).optional(),
  activo: z.boolean().optional(),
  password: z.string().min(6).optional(),
});

router.put("/:id", async (req, res) => {
  const id = Number(req.params.id);
  const parsed = actualizarSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

  const { password, ...rest } = parsed.data;
  const data: Record<string, unknown> = { ...rest };
  if (password) data.passwordHash = await bcrypt.hash(password, 10);

  const usuario = await prisma.usuario.update({
    where: { id },
    data,
    select: { id: true, nombre: true, email: true, rol: true, activo: true },
  });
  res.json(usuario);
});

export default router;
