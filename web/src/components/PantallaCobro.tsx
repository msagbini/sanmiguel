import { useState } from "react";
import { CheckCircle2, CreditCard, Radio, X } from "lucide-react";
import { api } from "../api";
import type { Configuracion } from "../types";

const formatoMoneda = new Intl.NumberFormat("es-CO", { style: "currency", currency: "COP", maximumFractionDigits: 0 });

export function PantallaCobro({
  monto,
  referencia,
  config,
  onConfirmar,
  onCancelar,
}: {
  monto: number;
  referencia: string;
  config: Configuracion;
  onConfirmar: () => void;
  onCancelar: () => void;
}) {
  const [enviando, setEnviando] = useState(false);
  const [estado, setEstado] = useState<{ ok: boolean; mensaje: string } | null>(null);
  const tieneProveedor = config.proveedorDatafono !== "NINGUNO";

  async function enviarADatafono() {
    setEnviando(true);
    setEstado(null);
    try {
      const resultado = await api.post<{ ok: boolean; mensaje: string }>("/pagos/datafono", { monto, referencia });
      setEstado(resultado);
    } catch {
      setEstado({ ok: false, mensaje: "No se pudo contactar el datáfono. Cobra manualmente." });
    } finally {
      setEnviando(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-brand-950 p-6 text-white">
      <button onClick={onCancelar} className="absolute right-4 top-4 rounded-full p-2 text-brand-100 hover:bg-brand-800">
        <X size={28} />
      </button>

      <CreditCard size={40} className="mb-4 text-gold-400" />
      <p className="text-lg text-brand-100">Cobrar en el datáfono</p>
      <p className="my-4 text-6xl font-black tracking-tight text-gold-400 sm:text-8xl">{formatoMoneda.format(monto)}</p>
      <p className="mb-8 max-w-sm text-center text-sm text-brand-100/70">
        Digita este monto exacto en el datáfono para que el cliente pague con su tarjeta.
      </p>

      {tieneProveedor && (
        <div className="mb-6 flex flex-col items-center gap-2">
          <button
            onClick={enviarADatafono}
            disabled={enviando}
            className="flex items-center gap-1.5 rounded-lg border border-gold-500 px-4 py-2 text-sm font-semibold text-gold-400 hover:bg-brand-800 disabled:opacity-50"
          >
            <Radio size={14} aria-hidden /> {enviando ? "Enviando..." : "Enviar automáticamente al datáfono"}
          </button>
          {estado && (
            <p className={`max-w-xs text-center text-xs ${estado.ok ? "text-green-400" : "text-amber-300"}`}>{estado.mensaje}</p>
          )}
        </div>
      )}

      <div className="flex w-full max-w-xs gap-3">
        <button onClick={onCancelar} className="flex-1 rounded-lg bg-brand-800 py-3 font-semibold text-white hover:bg-brand-700">
          Cancelar
        </button>
        <button onClick={onConfirmar} className="flex flex-1 items-center justify-center gap-1.5 rounded-lg bg-green-600 py-3 font-bold text-white hover:bg-green-500">
          <CheckCircle2 size={18} aria-hidden /> Ya pagó
        </button>
      </div>
    </div>
  );
}
