import "dotenv/config";
import express from "express";
import cors from "cors";
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

const app = express();
app.use(cors());
app.use(express.json());

app.get("/api/health", (_req, res) => res.json({ ok: true }));

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
  res.status(500).json({ error: "Error interno del servidor" });
});

const PORT = Number(process.env.PORT) || 4000;
app.listen(PORT, () => {
  console.log(`San Miguel API escuchando en http://localhost:${PORT}`);
});
