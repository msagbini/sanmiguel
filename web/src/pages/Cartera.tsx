import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { CheckCircle2, MessageCircle, Wallet, AlertTriangle, Users, X } from "lucide-react";
import { api, ApiError } from "../api";
import { useToast } from "../Toast";
import { StatCard } from "../components/StatCard";
import type { EstadoCuentaCliente, ResumenCartera } from "../types";

const formatoMoneda = new Intl.NumberFormat("es-CO", { style: "currency", currency: "COP", maximumFractionDigits: 0 });

const TIPO_LABELS: Record<string, string> = { CARGO: "Venta fiada", ABONO: "Abono recibido", AJUSTE: "Ajuste" };
const TIPO_COLOR: Record<string, string> = { CARGO: "text-red-700", ABONO: "text-green-700", AJUSTE: "text-stone-500" };

function linkWhatsapp(telefono: string, mensaje: string): string {
  const digitos = telefono.replace(/\D/g, "");
  const numero = digitos.length === 10 ? `57${digitos}` : digitos;
  return `https://wa.me/${numero}?text=${encodeURIComponent(mensaje)}`;
}

export function Cartera() {
  const { notificar } = useToast();
  const [searchParams, setSearchParams] = useSearchParams();
  const [resumen, setResumen] = useState<ResumenCartera | null>(null);
  const [clienteAbierto, setClienteAbierto] = useState<number | null>(null);
  const [cuenta, setCuenta] = useState<EstadoCuentaCliente | null>(null);
  const [monto, setMonto] = useState("");
  const [metodoPago, setMetodoPago] = useState("EFECTIVO");

  async function cargarResumen() {
    const data = await api.get<ResumenCartera>("/reportes/cartera");
    setResumen(data);
  }

  useEffect(() => {
    cargarResumen();
  }, []);

  useEffect(() => {
    const clienteParam = searchParams.get("cliente");
    if (clienteParam) abrirCliente(Number(clienteParam));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function abrirCliente(clienteId: number) {
    const data = await api.get<EstadoCuentaCliente>(`/clientes/${clienteId}/cuenta`);
    setCuenta(data);
    setClienteAbierto(clienteId);
    setMonto("");
  }

  function cerrar() {
    setClienteAbierto(null);
    setCuenta(null);
    if (searchParams.get("cliente")) setSearchParams({});
  }

  async function registrarAbono() {
    if (!clienteAbierto || !monto || Number(monto) <= 0) {
      notificar("Ingresa un monto válido", "error");
      return;
    }
    try {
      await api.post(`/clientes/${clienteAbierto}/abonos`, { monto: Number(monto), metodoPago });
      notificar("Abono registrado", "exito");
      await abrirCliente(clienteAbierto);
      cargarResumen();
    } catch (err) {
      notificar(err instanceof ApiError ? err.message : "No se pudo registrar el abono", "error");
    }
  }

  if (!resumen) return <div className="p-4 text-stone-500">Cargando...</div>;

  return (
    <div className="p-4">
      <h1 className="mb-4 text-xl font-bold text-stone-800">Cartera (fiado)</h1>

      <div className="mb-6 grid grid-cols-2 gap-3 md:grid-cols-3">
        <StatCard etiqueta="Total por cobrar" valor={formatoMoneda.format(resumen.totalCartera)} icon={Wallet} />
        <StatCard
          etiqueta={`Vencido (+${resumen.diasParaVencido} días)`}
          valor={formatoMoneda.format(resumen.totalVencido)}
          icon={AlertTriangle}
          tono="alerta"
        />
        <StatCard etiqueta="Clientes con deuda" valor={String(resumen.numeroClientes)} icon={Users} />
      </div>

      <div className="overflow-x-auto rounded-xl border border-stone-200 bg-white shadow-sm">
        <table className="w-full text-sm">
          <thead className="bg-stone-50 text-left text-xs uppercase text-stone-500">
            <tr>
              <th className="px-3 py-2">Cliente</th>
              <th className="px-3 py-2">Debe</th>
              <th className="px-3 py-2">Estado</th>
              <th className="px-3 py-2"></th>
            </tr>
          </thead>
          <tbody>
            {resumen.clientes.map((c) => (
              <tr key={c.clienteId} className="border-t border-stone-100">
                <td className="px-3 py-2 font-medium">{c.nombre}</td>
                <td className="px-3 py-2 font-semibold">{formatoMoneda.format(c.saldoPendiente)}</td>
                <td className="px-3 py-2">
                  {c.diasVencido > 0 ? (
                    <span className="rounded-full bg-red-100 px-2 py-0.5 text-xs font-semibold text-red-700">
                      Vencido hace {c.diasVencido} días
                    </span>
                  ) : (
                    <span className="rounded-full bg-green-100 px-2 py-0.5 text-xs font-semibold text-green-700">Al día</span>
                  )}
                </td>
                <td className="px-3 py-2">
                  <button onClick={() => abrirCliente(c.clienteId)} className="text-xs font-semibold text-brand-700 underline">
                    Ver cuenta
                  </button>
                </td>
              </tr>
            ))}
            {resumen.clientes.length === 0 && (
              <tr>
                <td colSpan={4} className="px-3 py-10 text-center text-stone-400">
                  <CheckCircle2 className="mx-auto mb-2 text-green-500" size={28} aria-hidden />
                  Nadie debe nada por ahora
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {clienteAbierto && cuenta && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/40 p-4">
          <div className="max-h-[90vh] w-full max-w-md overflow-y-auto rounded-xl bg-white p-6">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-lg font-bold">{cuenta.cliente.nombre}</h2>
              <button onClick={cerrar} aria-label="Cerrar" className="text-stone-400 hover:text-stone-700">
                <X size={18} aria-hidden />
              </button>
            </div>

            <div className="mb-4 rounded-lg bg-stone-50 p-3 text-sm">
              <div className="flex justify-between">
                <span>Debe actualmente</span>
                <span className="font-bold">{formatoMoneda.format(cuenta.cliente.saldoPendiente)}</span>
              </div>
              <div className="flex justify-between text-stone-500">
                <span>Cupo de fiado</span>
                <span>{formatoMoneda.format(cuenta.cliente.limiteCredito)}</span>
              </div>
              {cuenta.diasVencido > 0 && (
                <p className="mt-1 font-semibold text-red-700">Vencido hace {cuenta.diasVencido} días</p>
              )}
              {cuenta.cliente.telefono && (
                <a
                  href={linkWhatsapp(
                    cuenta.cliente.telefono,
                    `Hola ${cuenta.cliente.nombre}, te recordamos que tienes un saldo pendiente de ${formatoMoneda.format(cuenta.cliente.saldoPendiente)}. ¡Gracias!`
                  )}
                  target="_blank"
                  rel="noreferrer"
                  className="mt-2 inline-flex items-center gap-1.5 rounded-lg bg-green-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-green-700"
                >
                  <MessageCircle size={13} aria-hidden /> Enviar recordatorio por WhatsApp
                </a>
              )}
            </div>

            <div className="mb-4 rounded-lg border border-stone-200 p-3">
              <p className="mb-2 text-sm font-semibold">Registrar abono</p>
              <div className="flex gap-2">
                <input
                  type="number"
                  placeholder="Monto"
                  value={monto}
                  onChange={(e) => setMonto(e.target.value)}
                  className="flex-1 rounded-lg border border-stone-300 px-3 py-2 text-sm"
                />
                <select value={metodoPago} onChange={(e) => setMetodoPago(e.target.value)} className="rounded-lg border border-stone-300 px-2 py-2 text-sm">
                  <option value="EFECTIVO">Efectivo</option>
                  <option value="TRANSFERENCIA">Transferencia</option>
                  <option value="TARJETA">Tarjeta</option>
                </select>
              </div>
              <button onClick={registrarAbono} className="mt-2 w-full rounded-lg bg-green-700 py-2 text-sm font-semibold text-white hover:bg-green-800">
                Registrar abono
              </button>
            </div>

            <p className="mb-2 text-sm font-semibold">Historial</p>
            <div className="max-h-64 overflow-y-auto">
              {cuenta.movimientos.map((m) => (
                <div key={m.id} className="flex items-center justify-between border-b border-stone-100 py-2 text-sm last:border-0">
                  <div>
                    <p className={`font-medium ${TIPO_COLOR[m.tipo]}`}>{TIPO_LABELS[m.tipo] ?? m.tipo}</p>
                    <p className="text-xs text-stone-400">
                      {new Date(m.createdAt).toLocaleString("es-CO")} · {m.usuario?.nombre ?? "-"}
                    </p>
                  </div>
                  <span className={`font-semibold ${TIPO_COLOR[m.tipo]}`}>
                    {m.tipo === "ABONO" ? "-" : "+"}
                    {formatoMoneda.format(Math.abs(m.monto))}
                  </span>
                </div>
              ))}
              {cuenta.movimientos.length === 0 && <p className="py-4 text-center text-sm text-stone-400">Sin movimientos</p>}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
