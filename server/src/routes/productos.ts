import { Router } from "express";
import { z } from "zod";
import { prisma } from "../db";
import { requireAuth, requireRole } from "../middleware/auth";
import { UNIDADES, IVA_TASAS, TIPOS_MOVIMIENTO } from "../constants";

const router = Router();
router.use(requireAuth);

// GET /productos?buscar=texto&categoriaId=1&stockBajo=true&soloActivos=true
router.get("/", async (req, res) => {
  const { buscar, categoriaId, stockBajo, soloActivos } = req.query;

  const where: Record<string, unknown> = {};
  if (soloActivos !== "false") where.activo = true;
  if (categoriaId) where.categoriaId = Number(categoriaId);
  if (buscar) {
    where.OR = [
      { nombre: { contains: String(buscar) } },
      { codigoBarras: { contains: String(buscar) } },
    ];
  }

  let productos = await prisma.producto.findMany({
    where,
    include: { categoria: true },
    orderBy: { nombre: "asc" },
  });

  if (stockBajo === "true") {
    productos = productos.filter((p) => p.stock <= p.stockMinimo);
  }

  res.json(productos);
});

// Búsqueda puntual por código de barras exacto: la usa la pantalla de POS
// cuando la pistola lectora dispara un escaneo.
router.get("/codigo/:codigo", async (req, res) => {
  const producto = await prisma.producto.findUnique({
    where: { codigoBarras: req.params.codigo },
    include: { categoria: true },
  });
  if (!producto) return res.status(404).json({ error: "Producto no encontrado" });
  res.json(producto);
});

// Actividad reciente de inventario (todas las referencias) para el panel de Inventario.
router.get("/movimientos/recientes", async (_req, res) => {
  const movimientos = await prisma.movimientoInventario.findMany({
    include: { usuario: { select: { nombre: true } }, producto: { select: { nombre: true, unidad: true } } },
    orderBy: { createdAt: "desc" },
    take: 100,
  });
  res.json(movimientos);
});

router.get("/:id", async (req, res) => {
  const producto = await prisma.producto.findUnique({
    where: { id: Number(req.params.id) },
    include: { categoria: true },
  });
  if (!producto) return res.status(404).json({ error: "Producto no encontrado" });
  res.json(producto);
});

router.get("/:id/movimientos", async (req, res) => {
  const movimientos = await prisma.movimientoInventario.findMany({
    where: { productoId: Number(req.params.id) },
    include: { usuario: { select: { nombre: true } } },
    orderBy: { createdAt: "desc" },
    take: 100,
  });
  res.json(movimientos);
});

const productoSchema = z.object({
  codigoBarras: z.string().trim().min(1).nullish(),
  nombre: z.string().min(1),
  descripcion: z.string().nullish(),
  categoriaId: z.number().int().nullish(),
  unidad: z.enum(UNIDADES).default("UNIDAD"),
  precioCosto: z.number().min(0).default(0),
  precioVenta: z.number().min(0),
  ivaTasa: z.number().refine((v) => (IVA_TASAS as readonly number[]).includes(v), {
    message: "Tasa de IVA inválida (debe ser 0, 5 o 19)",
  }),
  stock: z.number().min(0).default(0),
  stockMinimo: z.number().min(0).default(0),
  imagenUrl: z.string().nullish(),
});

router.post("/", requireRole("ADMIN"), async (req, res) => {
  const parsed = productoSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

  try {
    const producto = await prisma.producto.create({ data: parsed.data });

    if (producto.stock > 0) {
      await prisma.movimientoInventario.create({
        data: {
          productoId: producto.id,
          tipo: "ENTRADA",
          cantidad: producto.stock,
          costoUnitario: producto.precioCosto,
          motivo: "Existencia inicial",
          usuarioId: req.user!.id,
        },
      });
    }

    res.status(201).json(producto);
  } catch {
    res.status(409).json({ error: "Ya existe un producto con ese código de barras" });
  }
});

router.put("/:id", requireRole("ADMIN"), async (req, res) => {
  const parsed = productoSchema.partial().safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

  try {
    const producto = await prisma.producto.update({
      where: { id: Number(req.params.id) },
      data: parsed.data,
    });
    res.json(producto);
  } catch {
    res.status(409).json({ error: "No se pudo actualizar (código de barras duplicado o producto inexistente)" });
  }
});

// Baja lógica: no se borra físicamente porque puede estar referenciado en ventas históricas.
router.delete("/:id", requireRole("ADMIN"), async (req, res) => {
  await prisma.producto.update({
    where: { id: Number(req.params.id) },
    data: { activo: false },
  });
  res.status(204).send();
});

const ajusteSchema = z.object({
  tipo: z.enum(TIPOS_MOVIMIENTO),
  cantidad: z.number().positive(),
  costoUnitario: z.number().min(0).optional(),
  motivo: z.string().optional(),
});

// Ajuste manual de inventario: entradas por compra, salidas por merma/daño,
// o corrección directa tras un conteo físico.
router.post("/:id/ajuste", requireRole("ADMIN"), async (req, res) => {
  const parsed = ajusteSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  const { tipo, cantidad, costoUnitario, motivo } = parsed.data;
  const productoId = Number(req.params.id);

  const producto = await prisma.producto.findUnique({ where: { id: productoId } });
  if (!producto) return res.status(404).json({ error: "Producto no encontrado" });

  let nuevoStock = producto.stock;
  if (tipo === "ENTRADA" || tipo === "DEVOLUCION") nuevoStock += cantidad;
  else if (tipo === "SALIDA") nuevoStock -= cantidad;
  else if (tipo === "AJUSTE") nuevoStock = cantidad; // AJUSTE fija el stock al valor contado

  if (nuevoStock < 0) {
    return res.status(400).json({ error: "El ajuste dejaría el inventario en negativo" });
  }

  const [productoActualizado] = await prisma.$transaction([
    prisma.producto.update({
      where: { id: productoId },
      data: {
        stock: nuevoStock,
        ...(tipo === "ENTRADA" && costoUnitario ? { precioCosto: costoUnitario } : {}),
      },
    }),
    prisma.movimientoInventario.create({
      data: {
        productoId,
        tipo,
        cantidad: tipo === "AJUSTE" ? nuevoStock - producto.stock : cantidad,
        costoUnitario,
        motivo,
        usuarioId: req.user!.id,
      },
    }),
  ]);

  res.json(productoActualizado);
});

export default router;
