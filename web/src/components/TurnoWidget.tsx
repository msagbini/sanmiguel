import { useEffect, useState } from "react";
import { Lock, Unlock } from "lucide-react";
import { api, ApiError } from "../api";
import { useToast } from "../Toast";
import type { Configuracion, ResumenTurno } from "../types";

const formatoMoneda = new Intl.NumberFormat("es-CO", { style: "currency", currency: "COP", maximumFractionDigits: 0 });

export function TurnoWidget() {
  const { notificar } = useToast();
  const [resumen, setResumen] = useState<ResumenTurno | null | undefined>(undefined);
  const [modal, setModal] = useState<"abrir" | "cerrar" | null>(null);
  const [fondoInicial, setFondoInicial] = useState("0");
  const [efectivoContado, setEfectivoContado] = useState("");
  const [notas, setNotas] = useState("");

  async function cargar() {
    const data = await api.get<ResumenTurno | null>("/turnos/actual");
    setResumen(data);
  }

  useEffect(() => {
    cargar();
    api.get<Configuracion>("/configuracion").then((c) => setFondoInicial(String(c.fondoCajaSugerido)));
  }, []);

  async function abrir() {
    try {
      await api.post("/turnos/abrir", { fondoInicial: Number(fondoInicial) || 0 });
      notificar("Caja abierta", "exito");
      setModal(null);
      cargar();
    } catch (err) {
      notificar(err instanceof ApiError ? err.message : "No se pudo abrir la caja", "error");
    }
  }

  async function cerrar() {
    if (!resumen) return;
    if (!efectivoContado) {
      notificar("Cuenta el efectivo en caja antes de cerrar", "error");
      return;
    }
    try {
      const cerrado = await api.post<{ diferencia: number }>(`/turnos/${resumen.turno.id}/cerrar`, {
        efectivoContado: Number(efectivoContado),
        notas: notas || undefined,
      });
      notificar(
        cerrado.diferencia === 0
          ? "Caja cerrada, cuadró exacto 🎉"
          : `Caja cerrada. Diferencia: ${formatoMoneda.format(cerrado.diferencia)}`,
        Math.abs(cerrado.diferencia) < 1 ? "exito" : "info"
      );
      setModal(null);
      setEfectivoContado("");
      setNotas("");
      cargar();
    } catch (err) {
      notificar(err instanceof ApiError ? err.message : "No se pudo cerrar la caja", "error");
    }
  }

  if (resumen === undefined) return null;

  return (
    <>
      <button
        onClick={() => setModal(resumen ? "cerrar" : "abrir")}
        className={`mx-3 mb-2 flex items-center gap-2 rounded-lg px-3 py-2 text-xs font-semibold ${
          resumen ? "bg-green-900/40 text-green-200 hover:bg-green-900/60" : "bg-red-900/40 text-red-200 hover:bg-red-900/60"
        }`}
      >
        {resumen ? <Unlock size={14} /> : <Lock size={14} />}
        {resumen ? `Caja abierta · ${formatoMoneda.format(resumen.efectivoEsperado)}` : "Caja cerrada — abrir turno"}
      </button>

      {modal === "abrir" && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-xs rounded-xl bg-white p-6 text-stone-800">
            <h2 className="mb-3 text-lg font-bold">Abrir caja</h2>
            <label className="text-sm">
              Base / fondo inicial en efectivo
              <input
                type="number"
                autoFocus
                value={fondoInicial}
                onChange={(e) => setFondoInicial(e.target.value)}
                className="input mt-1"
              />
            </label>
            <div className="mt-5 flex gap-2">
              <button onClick={abrir} className="btn-primary flex-1 py-2">
                Abrir
              </button>
              <button onClick={() => setModal(null)} className="flex-1 rounded-lg bg-stone-200 py-2 font-semibold">
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}

      {modal === "cerrar" && resumen && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-xs rounded-xl bg-white p-6 text-stone-800">
            <h2 className="mb-3 text-lg font-bold">Cerrar caja</h2>
            <div className="mb-3 rounded-lg bg-stone-50 p-3 text-sm">
              <div className="flex justify-between">
                <span>Fondo inicial</span>
                <span>{formatoMoneda.format(resumen.turno.fondoInicial)}</span>
              </div>
              <div className="flex justify-between">
                <span>Ventas en efectivo</span>
                <span>{formatoMoneda.format(resumen.totalVentasEfectivo)}</span>
              </div>
              {resumen.totalAbonosEfectivo > 0 && (
                <div className="flex justify-between">
                  <span>Abonos de fiado en efectivo</span>
                  <span>{formatoMoneda.format(resumen.totalAbonosEfectivo)}</span>
                </div>
              )}
              <div className="flex justify-between font-bold">
                <span>Esperado en caja</span>
                <span>{formatoMoneda.format(resumen.efectivoEsperado)}</span>
              </div>
            </div>
            <label className="text-sm">
              Efectivo contado físicamente
              <input
                type="number"
                autoFocus
                value={efectivoContado}
                onChange={(e) => setEfectivoContado(e.target.value)}
                className="input mt-1"
              />
            </label>
            <label className="mt-2 block text-sm">
              Notas (opcional)
              <input value={notas} onChange={(e) => setNotas(e.target.value)} className="input mt-1" />
            </label>
            <div className="mt-5 flex gap-2">
              <button onClick={cerrar} className="flex-1 rounded-lg bg-red-700 py-2 font-semibold text-white hover:bg-red-800">
                Cerrar caja
              </button>
              <button onClick={() => setModal(null)} className="flex-1 rounded-lg bg-stone-200 py-2 font-semibold">
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
