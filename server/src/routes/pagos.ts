import { Router } from "express";
import { z } from "zod";
import { prisma } from "../db";
import { requireAuth } from "../middleware/auth";
import { getTerminalProvider } from "../services/terminal";

const router = Router();
router.use(requireAuth);

const cobrarSchema = z.object({
  monto: z.number().positive(),
  referencia: z.string().min(1),
});

// Intenta enviar el cobro automáticamente al datáfono configurado (si hay
// uno). Si no hay proveedor configurado o falla, el frontend simplemente se
// queda en la pantalla de cobro manual: nunca bloquea la venta.
router.post("/datafono", async (req, res) => {
  const parsed = cobrarSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

  const config = await prisma.configuracion.upsert({ where: { id: 1 }, update: {}, create: {} });
  const provider = getTerminalProvider(config);

  try {
    const resultado = await provider.cobrar(parsed.data.monto, parsed.data.referencia, config);
    res.json(resultado);
  } catch (err) {
    res.status(200).json({
      ok: false,
      mensaje: err instanceof Error ? err.message : "No se pudo contactar al datáfono",
    });
  }
});

export default router;
