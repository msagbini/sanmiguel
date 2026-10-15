import { useEffect, useState } from "react";
import { Download } from "lucide-react";
import { api, ApiError } from "../api";
import { useAuth } from "../AuthContext";
import { useToast } from "../Toast";
import type { Configuracion, Venta } from "../types";
import { Recibo } from "../components/Recibo";
import { descargarCSV } from "../csv";

const formatoMoneda = new Intl.NumberFormat("es-CO", { style: "currency", currency: "COP", maximumFractionDigits: 0 });

export function Ventas() {
  const { usuario } = useAuth();
  const { notificar } = useToast();
  const [ventas, setVentas] = useState<Venta[]>([]);
  const [config, setConfig] = useState<Configuracion | null>(null);
  const [detalle, setDetalle] = useState<Venta | null>(null);
  const [motivoAnulacion, setMotivoAnulacion] = useState("");
  const [anulando, setAnulando] = useState(false);
  const [devolverAbierto, setDevolverAbierto] = useState(false);
  const [cantidadesDevolver, setCantidadesDevolver] = useState<Record<number, string>>({});
  const [motivoDevolucion, setMotivoDevolucion] = useState("");
  const [devolviendo, setDevolviendo] = useState(false);

  async function cargar() {
    const data = await api.get<Venta[]>("/ventas");
    setVentas(data);
  }

  useEffect(() => {
    cargar();
    api.get<Configuracion>("/configuracion").then(setConfig);
  }, []);

  async function verDetalle(id: number) {
    const venta = await api.get<Venta>(`/ventas/${id}`);
    setDetalle(venta);
    setDevolverAbierto(false);
    setCantidadesDevolver({});
    setMotivoDevolucion("");
  }

  async function anular() {
    if (!detalle || !motivoAnulacion.trim()) {
      notificar("Escribe el motivo de la anulación", "error");
      return;
    }
    setAnulando(true);
    try {
      await api.post(`/ventas/${detalle.id}/anular`, { motivo: motivoAnulacion });
      notificar("Venta anulada y stock repuesto", "exito");
      setDetalle(null);
      setMotivoAnulacion("");
      cargar();
    } catch (err) {
      notificar(err instanceof ApiError ? err.message : "No se pudo anular la venta", "error");
    } finally {
      setAnulando(false);
    }
  }

  async function devolver() {
    if (!detalle) return;
    if (!motivoDevolucion.trim()) {
      notificar("Escribe el motivo de la devolución", "error");
      return;
    }
    const items = Object.entries(cantidadesDevolver)
      .map(([ventaItemId, cantidad]) => ({ ventaItemId: Number(ventaItemId), cantidad: Number(cantidad) }))
      .filter((i) => i.cantidad > 0);
    if (items.length === 0) {
      notificar("Ingresa al menos una cantidad a devolver", "error");
      return;
    }
    setDevolviendo(true);
    try {
      await api.post(`/ventas/${detalle.id}/devolucion`, { items, motivo: motivoDevolucion });
      notificar("Devolución registrada y stock repuesto", "exito");
      const actualizado = await api.get<Venta>(`/ventas/${detalle.id}`);
      setDetalle(actualizado);
      setDevolverAbierto(false);
      setCantidadesDevolver({});
      setMotivoDevolucion("");
      cargar();
    } catch (err) {
      notificar(err instanceof ApiError ? err.message : "No se pudo registrar la devolución", "error");
    } finally {
      setDevolviendo(false);
    }
  }

  async function reintentarFactura() {
    if (!detalle) return;
    try {
      const res = await api.post<{ venta: Venta; facturacionElectronicaError: string | null }>(
        `/ventas/${detalle.id}/facturar`
      );
      setDetalle(res.venta);
      if (res.facturacionElectronicaError) {
        notificar(`Aún no se pudo facturar: ${res.facturacionElectronicaError}`, "error");
      } else {
        notificar("Factura electrónica emitida", "exito");
        cargar();
      }
    } catch (err) {
      notificar(err instanceof ApiError ? err.message : "No se pudo reintentar la facturación", "error");
    }
  }

  function exportar() {
    descargarCSV(
      `ventas-${new Date().toISOString().slice(0, 10)}.csv`,
      ventas.map((v) => ({
        numero: `${v.prefijo}-${v.numero}`,
        fecha: new Date(v.createdAt).toLocaleString("es-CO"),
        cliente: v.cliente?.nombre ?? "Consumidor Final",
        cajero: v.usuario?.nombre ?? "",
        formaPago: v.metodoPago,
        documento: v.tipoDocumento === "FACTURA_ELECTRONICA" ? "Factura DIAN" : "Documento POS",
        subtotal: v.subtotal.toFixed(0),
        descuento: v.descuento.toFixed(0),
        iva: v.ivaTotal.toFixed(0),
        total: v.total.toFixed(0),
        estado: v.estado,
      }))
    );
  }

  return (
    <div className="p-4">
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-xl font-bold text-stone-800">Ventas</h1>
        <button onClick={exportar} className="flex items-center gap-1.5 rounded-lg border border-stone-300 bg-white px-3 py-1.5 text-sm font-semibold text-stone-600 hover:bg-stone-50">
          <Download size={15} /> Exportar CSV
        </button>
      </div>

      <div className="overflow-x-auto rounded-lg border border-stone-200 bg-white">
        <table className="w-full text-sm">
          <thead className="bg-stone-50 text-left text-xs uppercase text-stone-500">
            <tr>
              <th className="px-3 py-2">No.</th>
              <th className="px-3 py-2">Fecha</th>
              <th className="px-3 py-2">Cliente</th>
              <th className="px-3 py-2">Cajero</th>
              <th className="px-3 py-2">Documento</th>
              <th className="px-3 py-2">Total</th>
              <th className="px-3 py-2">Estado</th>
              <th className="px-3 py-2"></th>
            </tr>
          </thead>
          <tbody>
            {ventas.map((v) => (
              <tr key={v.id} className="border-t border-stone-100">
                <td className="px-3 py-2 font-mono text-xs">
                  {v.prefijo}-{v.numero}
                </td>
                <td className="px-3 py-2">{new Date(v.createdAt).toLocaleString("es-CO")}</td>
                <td className="px-3 py-2">{v.cliente?.nombre ?? "Consumidor Final"}</td>
                <td className="px-3 py-2">{v.usuario?.nombre}</td>
                <td className="px-3 py-2">
                  <span
                    className={`rounded-full px-2 py-0.5 text-xs font-semibold ${
                      v.tipoDocumento === "FACTURA_ELECTRONICA" ? "bg-green-100 text-green-700" : "bg-stone-100 text-stone-600"
                    }`}
                  >
                    {v.tipoDocumento === "FACTURA_ELECTRONICA" ? "Factura DIAN" : "Documento POS"}
                  </span>
                </td>
                <td className="px-3 py-2 font-semibold">{formatoMoneda.format(v.total)}</td>
                <td className="px-3 py-2">
                  <span className={v.estado === "ANULADA" ? "font-semibold text-red-600" : "text-green-700"}>
                    {v.estado === "ANULADA" ? "Anulada" : "Completada"}
                  </span>
                </td>
                <td className="px-3 py-2">
                  <button onClick={() => verDetalle(v.id)} className="text-xs font-semibold text-brand-700 underline">
                    Ver
                  </button>
                </td>
              </tr>
            ))}
            {ventas.length === 0 && (
              <tr>
                <td colSpan={8} className="px-3 py-8 text-center text-stone-400">
                  Aún no hay ventas registradas
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {detalle && config && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/40 p-4">
          <div className="max-h-[90vh] w-full max-w-md overflow-y-auto rounded-xl bg-white p-4">
            <div className="no-imprimir mb-3 flex items-center justify-between">
              <h2 className="text-lg font-bold">
                Venta {detalle.prefijo}-{detalle.numero}
              </h2>
              <button
                onClick={() => {
                  setDetalle(null);
                  setMotivoAnulacion("");
                }}
                className="text-stone-400 hover:text-stone-700"
              >
                ✕
              </button>
            </div>

            <div className="rounded-lg border border-stone-200 bg-stone-50 py-3">
              <Recibo venta={detalle} config={config} />
            </div>

            <div className="no-imprimir mt-4 flex flex-col gap-2">
              <button onClick={() => window.print()} className="btn-primary py-2">
                🖨️ Imprimir
              </button>

              {detalle.estado === "COMPLETADA" && detalle.tipoDocumento === "DOCUMENTO_POS" && usuario?.rol === "ADMIN" && (
                <button onClick={reintentarFactura} className="rounded-lg bg-blue-700 py-2 font-semibold text-white">
                  Reintentar facturación electrónica DIAN
                </button>
              )}

              {detalle.totalDevuelto > 0 && (
                <p className="rounded-lg bg-amber-50 p-3 text-sm text-amber-800">
                  Ya se han devuelto {formatoMoneda.format(detalle.totalDevuelto)} de esta venta.
                </p>
              )}

              {detalle.estado === "COMPLETADA" && usuario?.rol === "ADMIN" && (
                <div className="rounded-lg border border-amber-200 bg-amber-50 p-3">
                  <button
                    onClick={() => setDevolverAbierto((v) => !v)}
                    className="mb-2 flex w-full items-center justify-between text-sm font-semibold text-amber-800"
                  >
                    <span>Devolución parcial (solo algunos ítems)</span>
                    <span>{devolverAbierto ? "▲" : "▼"}</span>
                  </button>
                  {devolverAbierto && (
                    <>
                      <div className="mb-2 flex flex-col gap-2">
                        {detalle.items.map((item) => {
                          const disponible = item.cantidad - item.cantidadDevuelta;
                          if (disponible <= 0) return null;
                          return (
                            <div key={item.id} className="flex items-center justify-between gap-2 text-xs">
                              <span className="flex-1">
                                {item.nombreProducto}
                                <span className="text-stone-400"> (disponible: {disponible})</span>
                              </span>
                              <input
                                type="number"
                                min={0}
                                max={disponible}
                                placeholder="0"
                                value={cantidadesDevolver[item.id] ?? ""}
                                onChange={(e) =>
                                  setCantidadesDevolver((prev) => ({ ...prev, [item.id]: e.target.value }))
                                }
                                className="w-16 rounded border border-stone-300 px-1.5 py-1"
                              />
                            </div>
                          );
                        })}
                        {detalle.items.every((item) => item.cantidad - item.cantidadDevuelta <= 0) && (
                          <p className="text-xs text-stone-400">Ya se devolvió todo lo de esta venta.</p>
                        )}
                      </div>
                      <input
                        value={motivoDevolucion}
                        onChange={(e) => setMotivoDevolucion(e.target.value)}
                        placeholder="Motivo de la devolución..."
                        className="mb-2 w-full rounded border border-amber-300 px-2 py-1.5 text-sm"
                      />
                      <button
                        onClick={devolver}
                        disabled={devolviendo}
                        className="w-full rounded-lg bg-amber-700 py-2 font-semibold text-white disabled:opacity-50"
                      >
                        Registrar devolución
                      </button>
                    </>
                  )}
                </div>
              )}

              {detalle.estado === "COMPLETADA" && usuario?.rol === "ADMIN" && (
                <div className="rounded-lg border border-red-200 bg-red-50 p-3">
                  <p className="mb-2 text-sm font-semibold text-red-700">Anular venta (deshace toda la venta)</p>
                  <input
                    value={motivoAnulacion}
                    onChange={(e) => setMotivoAnulacion(e.target.value)}
                    placeholder="Motivo de la anulación..."
                    className="mb-2 w-full rounded border border-red-300 px-2 py-1.5 text-sm"
                  />
                  <button
                    onClick={anular}
                    disabled={anulando}
                    className="w-full rounded-lg bg-red-700 py-2 font-semibold text-white disabled:opacity-50"
                  >
                    Anular y reponer inventario
                  </button>
                </div>
              )}
              {detalle.estado === "ANULADA" && (
                <p className="rounded-lg bg-red-50 p-3 text-sm text-red-700">
                  Anulada: {detalle.motivoAnulacion}
                </p>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
