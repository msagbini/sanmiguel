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
  nombreNegocio: z.string().trim().min(1).max(300).optional(),
  nit: z.string().max(50).nullish(),
  direccion: z.string().trim().min(1).max(300).optional(),
  telefono: z.string().max(50).nullish(),
  ciudad: z.string().trim().min(1).max(200).optional(),
  resolucionDianNumero: z.string().max(100).nullish(),
  resolucionDianPrefijo: z.string().max(20).nullish(),
  resolucionDianDesde: z.number().int().min(0).max(2_000_000_000).nullish(),
  resolucionDianHasta: z.number().int().min(0).max(2_000_000_000).nullish(),
  resolucionDianVigenciaDesde: z.coerce.date().nullish(),
  resolucionDianVigenciaHasta: z.coerce.date().nullish(),
  facturacionElectronicaHabilitada: z.boolean().optional(),
  proveedorFacturacion: z.enum(PROVEEDORES_FACTURACION).optional(),
  proveedorApiUrl: z.string().max(500).nullish(),
  proveedorApiKey: z.string().max(500).nullish(),
  proveedorApiSecret: z.string().max(500).nullish(),
  formatoRecibo: z.enum(["58MM", "80MM"]).optional(),
  tipoNegocio: z.string().max(50).optional(),
  limiteCreditoPorDefecto: z.number().min(0).finite().max(1_000_000_000).optional(),
  diasPlazoCreditoPorDefecto: z.number().int().min(1).max(3650).optional(),
  diasParaVencido: z.number().int().min(1).max(3650).optional(),
  margenAlertaPct: z.number().min(0).max(100).optional(),
  // Tope global de descuento del POS (1/2/3%, ver ventas.ts): no tiene
  // sentido permitir configurarlo por encima del máximo fijo del carrito.
  descuentoMaximoPct: z.number().min(0).max(3).optional(),
  habilitarFiado: z.boolean().optional(),
  diasAlertaVencimiento: z.number().int().min(1).max(3650).optional(),
  proveedorDatafono: z.enum(PROVEEDORES_DATAFONO).optional(),
  datafonoApiUrl: z.string().max(500).nullish(),
  datafonoApiKey: z.string().max(500).nullish(),
  datafonoApiSecret: z.string().max(500).nullish(),
  fondoCajaSugerido: z.number().min(0).finite().max(1_000_000_000).optional(),
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
