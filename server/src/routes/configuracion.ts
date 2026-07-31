import { Router } from "express";
import { z } from "zod";
import { prisma } from "../db";
import { requireAuth, requireRole } from "../middleware/auth";
import { PROVEEDORES_FACTURACION, PROVEEDORES_DATAFONO } from "../constants";

const router = Router();
router.use(requireAuth);

router.get("/", async (_req, res) => {
  const config = await prisma.configuracion.upsert({ where: { id: 1 }, update: {}, create: {} });
  // Nunca exponer los secretos completos al frontend, solo si están configurados.
  const { proveedorApiSecret, datafonoApiSecret, ...resto } = config;
  res.json({
    ...resto,
    proveedorApiSecretConfigurado: Boolean(proveedorApiSecret),
    datafonoApiSecretConfigurado: Boolean(datafonoApiSecret),
  });
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
  tipoNegocio: z.string().optional(),
  limiteCreditoPorDefecto: z.number().min(0).optional(),
  diasPlazoCreditoPorDefecto: z.number().int().min(1).optional(),
  diasParaVencido: z.number().int().min(1).optional(),
  margenAlertaPct: z.number().min(0).optional(),
  descuentoMaximoCajeroPct: z.number().min(0).max(100).optional(),
  habilitarFiado: z.boolean().optional(),
  diasAlertaVencimiento: z.number().int().min(1).optional(),
  proveedorDatafono: z.enum(PROVEEDORES_DATAFONO).optional(),
  datafonoApiUrl: z.string().nullish(),
  datafonoApiKey: z.string().nullish(),
  datafonoApiSecret: z.string().nullish(),
  fondoCajaSugerido: z.number().min(0).optional(),
});

router.put("/", requireRole("ADMIN"), async (req, res) => {
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

  // Si vienen vacíos, no se sobreescriben los secretos ya guardados.
  const data = { ...parsed.data };
  if (data.proveedorApiSecret === "") delete data.proveedorApiSecret;
  if (data.datafonoApiSecret === "") delete data.datafonoApiSecret;

  const config = await prisma.configuracion.upsert({
    where: { id: 1 },
    update: data,
    create: { id: 1, ...data },
  });
  const { proveedorApiSecret, datafonoApiSecret, ...resto } = config;
  res.json({
    ...resto,
    proveedorApiSecretConfigurado: Boolean(proveedorApiSecret),
    datafonoApiSecretConfigurado: Boolean(datafonoApiSecret),
  });
});

export default router;
