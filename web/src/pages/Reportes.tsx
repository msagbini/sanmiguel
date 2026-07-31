import { useEffect, useState } from "react";
import { Download } from "lucide-react";
import { api } from "../api";
import type { ResumenReporte, TopProducto } from "../types";
import { descargarCSV } from "../csv";

const formatoMoneda = new Intl.NumberFormat("es-CO", { style: "currency", currency: "COP", maximumFractionDigits: 0 });

function inicioDeHoy() {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d.toISOString().slice(0, 10);
}

function inicioDeMes() {
  const d = new Date();
  return new Date(d.getFullYear(), d.getMonth(), 1).toISOString().slice(0, 10);
}

export function Reportes() {
  const [desde, setDesde] = useState(inicioDeHoy());
  const [hasta, setHasta] = useState(new Date().toISOString().slice(0, 10));
  const [resumen, setResumen] = useState<ResumenReporte | null>(null);
  const [top, setTop] = useState<TopProducto[]>([]);
  const [porDia, setPorDia] = useState<{ fecha: string; total: number }[]>([]);

  async function cargar() {
    const qs = `?desde=${desde}T00:00:00&hasta=${hasta}T23:59:59`;
    const [r, t, d] = await Promise.all([
      api.get<ResumenReporte>(`/reportes/resumen${qs}`),
      api.get<TopProducto[]>(`/reportes/top-productos${qs}`),
      api.get<{ fecha: string; total: number }[]>(`/reportes/ventas-por-dia${qs}`),
    ]);
    setResumen(r);
    setTop(t);
    setPorDia(d);
  }

  useEffect(() => {
    cargar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [desde, hasta]);

  const maxDia = Math.max(1, ...porDia.map((d) => d.total));

  return (
    <div className="p-4">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-xl font-bold text-stone-800">Reportes</h1>
        <div className="flex items-center gap-2 text-sm">
          <button onClick={() => { setDesde(inicioDeHoy()); setHasta(new Date().toISOString().slice(0, 10)); }} className="rounded-full border border-stone-300 bg-white px-3 py-1 hover:bg-stone-50">
            Hoy
          </button>
          <button onClick={() => { setDesde(inicioDeMes()); setHasta(new Date().toISOString().slice(0, 10)); }} className="rounded-full border border-stone-300 bg-white px-3 py-1 hover:bg-stone-50">
            Este mes
          </button>
          <input type="date" value={desde} onChange={(e) => setDesde(e.target.value)} className="rounded border border-stone-300 px-2 py-1" />
          <span>a</span>
          <input type="date" value={hasta} onChange={(e) => setHasta(e.target.value)} className="rounded border border-stone-300 px-2 py-1" />
        </div>
      </div>

      {resumen && (
        <div className="mb-6 grid grid-cols-2 gap-3 md:grid-cols-4">
          <TarjetaResumen etiqueta="Ventas" valor={formatoMoneda.format(resumen.totalVentas)} />
          <TarjetaResumen etiqueta="Ganancia estimada" valor={formatoMoneda.format(resumen.ganancia)} destacado />
          <TarjetaResumen etiqueta="No. de ventas" valor={String(resumen.numeroVentas)} />
          <TarjetaResumen etiqueta="Ticket promedio" valor={formatoMoneda.format(resumen.ticketPromedio)} />
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <div className="rounded-lg border border-stone-200 bg-white p-4">
          <h2 className="mb-3 font-bold text-stone-800">Ventas por día</h2>
          <div className="flex flex-col gap-1.5">
            {porDia.map((d) => (
              <div key={d.fecha} className="flex items-center gap-2 text-sm">
                <span className="w-24 shrink-0 text-stone-500">{d.fecha}</span>
                <div className="h-4 flex-1 rounded bg-stone-100">
                  <div
                    className="h-4 rounded bg-brand-700"
                    style={{ width: `${(d.total / maxDia) * 100}%` }}
                  />
                </div>
                <span className="w-24 shrink-0 text-right font-medium">{formatoMoneda.format(d.total)}</span>
              </div>
            ))}
            {porDia.length === 0 && <p className="text-sm text-stone-400">Sin ventas en el rango seleccionado</p>}
          </div>
        </div>

        <div className="rounded-lg border border-stone-200 bg-white p-4">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="font-bold text-stone-800">Productos más vendidos</h2>
            <button
              onClick={() =>
                descargarCSV(
                  `productos-mas-vendidos-${desde}-a-${hasta}.csv`,
                  top.map((t) => ({ producto: t.nombre, cantidad: t.cantidad, total: t.total.toFixed(0) }))
                )
              }
              className="flex items-center gap-1 text-xs font-semibold text-stone-500 hover:text-stone-700"
            >
              <Download size={13} /> CSV
            </button>
          </div>
          <table className="w-full text-sm">
            <thead className="text-left text-xs uppercase text-stone-500">
              <tr>
                <th className="py-1">Producto</th>
                <th className="py-1 text-right">Cantidad</th>
                <th className="py-1 text-right">Total</th>
              </tr>
            </thead>
            <tbody>
              {top.map((p) => (
                <tr key={p.productoId} className="border-t border-stone-100">
                  <td className="py-1.5">{p.nombre}</td>
                  <td className="py-1.5 text-right">{p.cantidad}</td>
                  <td className="py-1.5 text-right font-medium">{formatoMoneda.format(p.total)}</td>
                </tr>
              ))}
              {top.length === 0 && (
                <tr>
                  <td colSpan={3} className="py-4 text-center text-stone-400">
                    Sin datos
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function TarjetaResumen({ etiqueta, valor, destacado }: { etiqueta: string; valor: string; destacado?: boolean }) {
  return (
    <div className={`rounded-lg border p-4 ${destacado ? "border-green-300 bg-green-50" : "border-stone-200 bg-white"}`}>
      <p className="text-xs font-medium uppercase text-stone-500">{etiqueta}</p>
      <p className={`mt-1 text-xl font-bold ${destacado ? "text-green-700" : "text-stone-800"}`}>{valor}</p>
    </div>
  );
}
