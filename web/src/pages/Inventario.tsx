import { useEffect, useState } from "react";
import { api } from "../api";
import type { MovimientoInventario, Producto } from "../types";
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
  const [stockBajo, setStockBajo] = useState<Producto[]>([]);
  const [movimientos, setMovimientos] = useState<MovimientoInventario[]>([]);

  useEffect(() => {
    api.get<Producto[]>("/reportes/stock-bajo").then(setStockBajo);
    api.get<MovimientoInventario[]>("/productos/movimientos/recientes").then(setMovimientos);
  }, []);

  return (
    <div className="grid grid-cols-1 gap-4 p-4 lg:grid-cols-2">
      <div>
        <h2 className="mb-3 text-lg font-bold text-stone-800">
          ⚠️ Productos con stock bajo ({stockBajo.length})
        </h2>
        <div className="overflow-hidden rounded-lg border border-stone-200 bg-white">
          {stockBajo.length === 0 && <p className="p-4 text-sm text-stone-400">Todo el inventario está por encima del mínimo. 🎉</p>}
          {stockBajo.map((p) => (
            <div key={p.id} className="flex items-center justify-between border-b border-stone-100 px-4 py-3 last:border-0">
              <div>
                <p className="text-sm font-medium">{p.nombre}</p>
                <p className="text-xs text-stone-400">Mínimo: {p.stockMinimo} {UNIDAD_LABELS[p.unidad]}</p>
              </div>
              <span className="rounded-full bg-red-100 px-3 py-1 text-sm font-bold text-red-700">
                {p.stock} {UNIDAD_LABELS[p.unidad]}
              </span>
            </div>
          ))}
        </div>
      </div>

      <div>
        <h2 className="mb-3 text-lg font-bold text-stone-800">Actividad reciente de inventario</h2>
        <div className="max-h-[70vh] overflow-y-auto rounded-lg border border-stone-200 bg-white">
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
