import "dotenv/config";
// Debe importarse antes que las rutas: envuelve automáticamente los
// controladores async de Express 4 para que un reject no capturado no cuelgue
// la respuesta ni tumbe el proceso completo.
import "express-async-errors";
import express from "express";
import cors from "cors";
import helmet from "helmet";
import { loginLimiter, apiLimiter } from "./middleware/rateLimit";
import authRoutes from "./routes/auth";
import usuariosRoutes from "./routes/usuarios";
import categoriasRoutes from "./routes/categorias";
import productosRoutes from "./routes/productos";
import ventasRoutes from "./routes/ventas";
import clientesRoutes from "./routes/clientes";
import reportesRoutes from "./routes/reportes";
import configuracionRoutes from "./routes/configuracion";
import lotesRoutes from "./routes/lotes";
import turnosRoutes from "./routes/turnos";
import pagosRoutes from "./routes/pagos";

// El JWT_SECRET protege todas las sesiones de la app (admin y cajeros). Si no
// se define uno propio, arrancar igual con un secreto por defecto conocido
// públicamente sería como dejar la puerta sin llave. En producción es
// obligatorio configurarlo; en desarrollo se avisa fuerte pero se deja seguir.
const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET || JWT_SECRET.length < 16) {
  if (process.env.NODE_ENV === "production") {
    throw new Error(
      "JWT_SECRET no está configurado (o es muy corto) en un entorno de producción. " +
        "Define una variable de entorno JWT_SECRET con al menos 32 caracteres aleatorios antes de arrancar.",
    );
  }
  console.warn(
    "\n[ADVERTENCIA] JWT_SECRET no está configurado o es muy corto. " +
      "Se está usando un valor por defecto SOLO apto para desarrollo local. " +
      "Antes de operar en producción, define JWT_SECRET en server/.env con un valor largo y aleatorio.\n",
  );
}

const app = express();
app.set("trust proxy", 1);
app.use(helmet());

// Por defecto solo se permite el origen del propio frontend (Vite en dev).
// Se puede ampliar con CORS_ORIGIN="https://a.com,https://b.com" en .env.
const origenesPermitidos = (process.env.CORS_ORIGIN ?? "http://localhost:5173")
  .split(",")
  .map((o) => o.trim())
  .filter(Boolean);
app.use(
  cors({
    origin: origenesPermitidos,
  }),
);

// Límite de tamaño de body: una venta o un producto nunca necesitan más de
// unos pocos KB; esto corta de raíz payloads gigantes usados para agotar memoria.
app.use(express.json({ limit: "1mb" }));

app.get("/api/health", (_req, res) => res.json({ ok: true }));

// Límite general anti fuerza-bruta/abuso sobre toda la API, y uno más
// estricto específicamente sobre el login (el punto de entrada más atacado).
app.use("/api", apiLimiter);
app.use("/api/auth/login", loginLimiter);

app.use("/api/auth", authRoutes);
app.use("/api/usuarios", usuariosRoutes);
app.use("/api/categorias", categoriasRoutes);
app.use("/api/productos", productosRoutes);
app.use("/api/ventas", ventasRoutes);
app.use("/api/clientes", clientesRoutes);
app.use("/api/reportes", reportesRoutes);
app.use("/api/configuracion", configuracionRoutes);
app.use("/api/lotes", lotesRoutes);
app.use("/api/turnos", turnosRoutes);
app.use("/api/pagos", pagosRoutes);

// eslint-disable-next-line @typescript-eslint/no-unused-vars
app.use((err: any, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error(err);
  // SQLite solo permite un escritor a la vez: bajo una ráfaga real de
  // solicitudes simultáneas, Prisma puede agotar el tiempo de espera por el
  // candado de escritura (P1008/P2028) en vez de fallar por un error de
  // lógica. Vale la pena distinguirlo para que el cajero sepa que debe
  // reintentar, no que la venta quedó mal.
  if (err?.code === "P1008" || err?.code === "P2028") {
    return res.status(503).json({ error: "El sistema está ocupado en este momento. Espera un segundo e inténtalo de nuevo." });
  }
  res.status(500).json({ error: "Error interno del servidor" });
});

const PORT = Number(process.env.PORT) || 4000;
app.listen(PORT, () => {
  console.log(`San Miguel API escuchando en http://localhost:${PORT}`);
});
