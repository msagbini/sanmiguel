import { useEffect, useState } from "react";
import { api, ApiError } from "../api";
import { useToast } from "../Toast";
import type { LoteInventario, MovimientoInventario, Producto } from "../types";
import { UNIDAD_LABELS } from "../types";

const TIPO_LABELS: Record<string, string> = {
  ENTRADA: "Entrada",
  SALIDA: "Salida",
  AJUSTE: "Ajuste",
  VENTA: "Venta",
  DEVOLUCION: "Devolución",
};

const TIPO_COLOR: Record<string, string> = {
  ENTRADA: "text-green-700",
  SALIDA: "text-red-700",
  AJUSTE: "text-blue-700",
  VENTA: "text-stone-700",
  DEVOLUCION: "text-amber-700",
};

export function Inventario() {
  const { notificar } = useToast();
  const [stockBajo, setStockBajo] = useState<Producto[]>([]);
  const [movimientos, setMovimientos] = useState<MovimientoInventario[]>([]);
  const [lotes, setLotes] = useState<LoteInventario[]>([]);
  const [productos, setProductos] = useState<Producto[]>([]);
  const [busquedaStock, setBusquedaStock] = useState("");

  async function cargarVencimientos() {
    const data = await api.get<LoteInventario[]>("/lotes?dias=60");
    setLotes(data);
  }

  useEffect(() => {
    api.get<Producto[]>("/reportes/stock-bajo").then(setStockBajo);
    api.get<MovimientoInventario[]>("/productos/movimientos/recientes").then(setMovimientos);
    api.get<Producto[]>("/productos").then((data) => setProductos(data.sort((a, b) => a.nombre.localeCompare(b.nombre))));
    cargarVencimientos();
  }, []);

  const productosFiltrados = productos.filter((p) => {
    const q = busquedaStock.trim().toLowerCase();
    if (!q) return true;
    return p.nombre.toLowerCase().includes(q) || (p.codigoBarras ?? "").includes(q) || (p.categoria?.nombre ?? "").toLowerCase().includes(q);
  });

  async function darDeBaja(lote: LoteInventario) {
    const motivo = prompt(`¿Por qué se da de baja "${lote.producto?.nombre}"? (vencido, dañado, etc.)`);
    if (!motivo) return;
    try {
      await api.post(`/lotes/${lote.id}/dar-de-baja`, { motivo });
      notificar("Lote dado de baja y descontado del inventario", "exito");
      cargarVencimientos();
      api.get<Producto[]>("/reportes/stock-bajo").then(setStockBajo);
    } catch (err) {
      notificar(err instanceof ApiError ? err.message : "No se pudo dar de baja el lote", "error");
    }
  }

  const vencidos = lotes.filter((l) => l.vencido);
  const porVencer = lotes.filter((l) => !l.vencido);

  return (
    <div className="grid grid-cols-1 gap-4 p-4 lg:grid-cols-2">
      <div className="lg:col-span-2">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-lg font-bold text-stone-800">Stock disponible ahora ({productosFiltrados.length})</h2>
          <input
            value={busquedaStock}
            onChange={(e) => setBusquedaStock(e.target.value)}
            placeholder="Buscar producto, código o categoría..."
            className="w-full max-w-xs rounded-lg border border-stone-300 px-3 py-2 text-sm"
          />
        </div>
        <div className="max-h-[50vh] overflow-y-auto overflow-x-auto rounded-lg border border-stone-200 bg-white">
          <table className="w-full text-sm">
            <thead className="sticky top-0 bg-stone-50 text-left text-xs uppercase text-stone-500">
              <tr>
                <th className="px-3 py-2">Producto</th>
                <th className="px-3 py-2">Categoría</th>
                <th className="px-3 py-2">Código</th>
                <th className="px-3 py-2">Disponible para vender</th>
              </tr>
            </thead>
            <tbody>
              {productosFiltrados.map((p) => (
                <tr key={p.id} className="border-t border-stone-100">
                  <td className="px-3 py-2 font-medium">{p.nombre}</td>
                  <td className="px-3 py-2 text-stone-500">{p.categoria?.nombre ?? "-"}</td>
                  <td className="px-3 py-2 text-stone-500">{p.codigoBarras ?? "-"}</td>
                  <td className={`px-3 py-2 font-semibold ${p.stock <= p.stockMinimo ? "text-red-600" : "text-green-700"}`}>
                    {p.stock} {UNIDAD_LABELS[p.unidad]}
                  </td>
                </tr>
              ))}
              {productosFiltrados.length === 0 && (
                <tr>
                  <td colSpan={4} className="px-3 py-8 text-center text-stone-400">
                    Sin resultados
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div>
        <h2 className="mb-3 text-lg font-bold text-stone-800">⚠️ Productos con stock bajo ({stockBajo.length})</h2>
        <div className="overflow-hidden rounded-lg border border-stone-200 bg-white">
          {stockBajo.length === 0 && <p className="p-4 text-sm text-stone-400">Todo el inventario está por encima del mínimo. 🎉</p>}
          {stockBajo.map((p) => (
            <div key={p.id} className="flex items-center justify-between border-b border-stone-100 px-4 py-3 last:border-0">
              <div>
                <p className="text-sm font-medium">{p.nombre}</p>
                <p className="text-xs text-stone-400">
                  Mínimo: {p.stockMinimo} {UNIDAD_LABELS[p.unidad]}
                </p>
              </div>
              <span className="rounded-full bg-red-100 px-3 py-1 text-sm font-bold text-red-700">
                {p.stock} {UNIDAD_LABELS[p.unidad]}
              </span>
            </div>
          ))}
        </div>
      </div>

      <div>
        <h2 className="mb-3 text-lg font-bold text-stone-800">
          ⏳ Vencimientos ({vencidos.length} vencidos, {porVencer.length} por vencer)
        </h2>
        <div className="overflow-hidden rounded-lg border border-stone-200 bg-white">
          {lotes.length === 0 && <p className="p-4 text-sm text-stone-400">No hay lotes con vencimiento próximo registrados.</p>}
          {[...vencidos, ...porVencer].map((lote) => (
            <div key={lote.id} className="flex items-center justify-between gap-2 border-b border-stone-100 px-4 py-3 last:border-0">
              <div>
                <p className="text-sm font-medium">{lote.producto?.nombre}</p>
                <p className={`text-xs ${lote.vencido ? "font-semibold text-red-600" : "text-amber-600"}`}>
                  {lote.vencido ? "Venció el " : "Vence el "}
                  {lote.fechaVencimiento && new Date(lote.fechaVencimiento).toLocaleDateString("es-CO")} · {lote.cantidadDisponible}{" "}
                  {UNIDAD_LABELS[lote.producto?.unidad ?? "UNIDAD"]}
                </p>
              </div>
              <button
                onClick={() => darDeBaja(lote)}
                className="shrink-0 whitespace-nowrap rounded-lg border border-red-300 px-2 py-1 text-xs font-semibold text-red-700 hover:bg-red-50"
              >
                Dar de baja
              </button>
            </div>
          ))}
        </div>
      </div>

      <div className="lg:col-span-2">
        <h2 className="mb-3 text-lg font-bold text-stone-800">Actividad reciente de inventario</h2>
        <div className="max-h-[50vh] overflow-y-auto rounded-lg border border-stone-200 bg-white">
          {movimientos.map((m) => (
            <div key={m.id} className="flex items-center justify-between border-b border-stone-100 px-4 py-2.5 text-sm last:border-0">
              <div>
                <p className="font-medium">{m.producto?.nombre}</p>
                <p className="text-xs text-stone-400">
                  {new Date(m.createdAt).toLocaleString("es-CO")} · {m.usuario?.nombre ?? "Sistema"}
                  {m.motivo ? ` · ${m.motivo}` : ""}
                </p>
              </div>
              <span className={`font-semibold ${TIPO_COLOR[m.tipo]}`}>
                {m.tipo === "SALIDA" || m.tipo === "VENTA" ? "-" : "+"}
                {m.cantidad} · {TIPO_LABELS[m.tipo]}
              </span>
            </div>
          ))}
          {movimientos.length === 0 && <p className="p-4 text-sm text-stone-400">Sin movimientos todavía</p>}
        </div>
      </div>
    </div>
  );
}
