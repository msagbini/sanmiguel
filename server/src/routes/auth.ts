import { Router } from "express";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { prisma } from "../db";
import { signToken, requireAuth } from "../middleware/auth";
import { Rol } from "../constants";

const router = Router();

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

router.post("/login", async (req, res) => {
  const parsed = loginSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: "Email y contraseña son requeridos" });
  }
  const { email, password } = parsed.data;

  const usuario = await prisma.usuario.findUnique({ where: { email } });
  if (!usuario || !usuario.activo) {
    return res.status(401).json({ error: "Credenciales inválidas" });
  }
  const ok = await bcrypt.compare(password, usuario.passwordHash);
  if (!ok) {
    return res.status(401).json({ error: "Credenciales inválidas" });
  }

  const token = signToken({
    id: usuario.id,
    nombre: usuario.nombre,
    email: usuario.email,
    rol: usuario.rol as Rol,
  });

  res.json({
    token,
    usuario: { id: usuario.id, nombre: usuario.nombre, email: usuario.email, rol: usuario.rol },
  });
});

router.get("/me", requireAuth, async (req, res) => {
  res.json({ usuario: req.user });
});

export default router;
