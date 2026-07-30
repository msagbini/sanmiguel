import { Router } from "express";
import { z } from "zod";
import { prisma } from "../db";
import { requireAuth, requireRole } from "../middleware/auth";
import { PROVEEDORES_FACTURACION } from "../constants";

const router = Router();
router.use(requireAuth);

router.get("/", async (_req, res) => {
  const config = await prisma.configuracion.upsert({ where: { id: 1 }, update: {}, create: {} });
  // Nunca exponer el api secret completo al frontend, solo si está configurado.
  const { proveedorApiSecret, ...resto } = config;
  res.json({ ...resto, proveedorApiSecretConfigurado: Boolean(proveedorApiSecret) });
});

const schema = z.object({
  nombreNegocio: z.string().min(1).optional(),
  nit: z.string().nullish(),
  direccion: z.string().min(1).optional(),
  telefono: z.string().nullish(),
  ciudad: z.string().min(1).optional(),
  resolucionDianNumero: z.string().nullish(),
  resolucionDianPrefijo: z.string().nullish(),
  resolucionDianDesde: z.number().int().nullish(),
  resolucionDianHasta: z.number().int().nullish(),
  resolucionDianVigenciaDesde: z.coerce.date().nullish(),
  resolucionDianVigenciaHasta: z.coerce.date().nullish(),
  facturacionElectronicaHabilitada: z.boolean().optional(),
  proveedorFacturacion: z.enum(PROVEEDORES_FACTURACION).optional(),
  proveedorApiUrl: z.string().nullish(),
  proveedorApiKey: z.string().nullish(),
  proveedorApiSecret: z.string().nullish(),
  formatoRecibo: z.enum(["58MM", "80MM"]).optional(),
});

router.put("/", requireRole("ADMIN"), async (req, res) => {
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

  // Si viene vacío, no se sobreescribe el secreto ya guardado.
  const data = { ...parsed.data };
  if (data.proveedorApiSecret === "") delete data.proveedorApiSecret;

  const config = await prisma.configuracion.upsert({
    where: { id: 1 },
    update: data,
    create: { id: 1, ...data },
  });
  const { proveedorApiSecret, ...resto } = config;
  res.json({ ...resto, proveedorApiSecretConfigurado: Boolean(proveedorApiSecret) });
});

export default router;
