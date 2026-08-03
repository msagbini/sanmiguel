import { useEffect, useState } from "react";
import { CheckCircle2, Truck, Users, X } from "lucide-react";
import { api, ApiError } from "../api";
import { useToast } from "../Toast";
import { StatCard } from "../components/StatCard";
import type { EstadoCuentaProveedor, Proveedor, ResumenCuentasPorPagar } from "../types";

const formatoMoneda = new Intl.NumberFormat("es-CO", { style: "currency", currency: "COP", maximumFractionDigits: 0 });

const TIPO_LABELS: Record<string, string> = { CARGO: "Compra a crédito", ABONO: "Pago realizado", AJUSTE: "Ajuste" };
const TIPO_COLOR: Record<string, string> = { CARGO: "text-red-700", ABONO: "text-green-700", AJUSTE: "text-stone-500" };

export function CuentasPorPagar() {
  const { notificar } = useToast();
  const [resumen, setResumen] = useState<ResumenCuentasPorPagar | null>(null);
  const [proveedores, setProveedores] = useState<Proveedor[]>([]);
  const [proveedorAbierto, setProveedorAbierto] = useState<number | null>(null);
  const [cuenta, setCuenta] = useState<EstadoCuentaProveedor | null>(null);
  const [montoPago, setMontoPago] = useState("");
  const [montoCargo, setMontoCargo] = useState("");
  const [motivoCargo, setMotivoCargo] = useState("");

  async function cargarResumen() {
    const [r, p] = await Promise.all([
      api.get<ResumenCuentasPorPagar>("/reportes/cuentas-por-pagar"),
      api.get<Proveedor[]>("/proveedores"),
    ]);
    setResumen(r);
    setProveedores(p);
  }

  useEffect(() => {
    cargarResumen();
  }, []);

  async function abrirProveedor(proveedorId: number) {
    const data = await api.get<EstadoCuentaProveedor>(`/proveedores/${proveedorId}/cuenta`);
    setCuenta(data);
    setProveedorAbierto(proveedorId);
    setMontoPago("");
    setMontoCargo("");
    setMotivoCargo("");
  }

  function cerrar() {
    setProveedorAbierto(null);
    setCuenta(null);
  }

  async function registrarPago() {
    if (!proveedorAbierto || !montoPago || Number(montoPago) <= 0) {
      notificar("Ingresa un monto válido", "error");
      return;
    }
    try {
      await api.post(`/proveedores/${proveedorAbierto}/pagos`, { monto: Number(montoPago) });
      notificar("Pago registrado", "exito");
      await abrirProveedor(proveedorAbierto);
      cargarResumen();
    } catch (err) {
      notificar(err instanceof ApiError ? err.message : "No se pudo registrar el pago", "error");
    }
  }

  async function registrarCargo() {
    if (!proveedorAbierto || !montoCargo || Number(montoCargo) <= 0) {
      notificar("Ingresa un monto válido", "error");
      return;
    }
    if (!motivoCargo.trim()) {
      notificar("Escribe el motivo (ej. qué mercancía se recibió)", "error");
      return;
    }
    try {
      await api.post(`/proveedores/${proveedorAbierto}/cargos`, { monto: Number(montoCargo), motivo: motivoCargo });
      notificar("Deuda registrada", "exito");
      await abrirProveedor(proveedorAbierto);
      cargarResumen();
    } catch (err) {
      notificar(err instanceof ApiError ? err.message : "No se pudo registrar la deuda", "error");
    }
  }

  if (!resumen) return <div className="p-4 text-stone-500">Cargando...</div>;

  const sinDeuda = proveedores.filter((p) => p.saldoPendiente <= 0);

  return (
    <div className="p-4">
      <h1 className="mb-4 text-xl font-bold text-stone-800">Cuentas por pagar (proveedores)</h1>

      <div className="mb-6 grid grid-cols-2 gap-3 md:grid-cols-3">
        <StatCard etiqueta="Total que se debe" valor={formatoMoneda.format(resumen.total)} icon={Truck} />
        <StatCard etiqueta="Proveedores con deuda" valor={String(resumen.numeroProveedores)} icon={Users} />
      </div>

      <div className="overflow-x-auto rounded-xl border border-stone-200 bg-white shadow-sm">
        <table className="w-full text-sm">
          <thead className="bg-stone-50 text-left text-xs uppercase text-stone-500">
            <tr>
              <th className="px-3 py-2">Proveedor</th>
              <th className="px-3 py-2">Se le debe</th>
              <th className="px-3 py-2"></th>
            </tr>
          </thead>
          <tbody>
            {resumen.proveedores.map((p) => (
              <tr key={p.proveedorId} className="border-t border-stone-100">
                <td className="px-3 py-2 font-medium">{p.nombre}</td>
                <td className="px-3 py-2 font-semibold text-red-700">{formatoMoneda.format(p.saldoPendiente)}</td>
                <td className="px-3 py-2">
                  <button onClick={() => abrirProveedor(p.proveedorId)} className="text-xs font-semibold text-brand-700 underline">
                    Ver cuenta
                  </button>
                </td>
              </tr>
            ))}
            {resumen.proveedores.length === 0 && (
              <tr>
                <td colSpan={3} className="px-3 py-10 text-center text-stone-400">
                  <CheckCircle2 className="mx-auto mb-2 text-green-500" size={28} aria-hidden />
                  No se le debe nada a ningún proveedor por ahora
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {sinDeuda.length > 0 && (
        <div className="mt-6">
          <p className="mb-2 text-sm font-semibold text-stone-600">Otros proveedores (sin deuda actual)</p>
          <div className="flex flex-wrap gap-2">
            {sinDeuda.map((p) => (
              <button
                key={p.id}
                onClick={() => abrirProveedor(p.id)}
                className="rounded-full border border-stone-300 bg-white px-3 py-1 text-xs text-stone-600 hover:bg-stone-50"
              >
                {p.nombre}
              </button>
            ))}
          </div>
        </div>
      )}

      {proveedorAbierto && cuenta && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/40 p-4">
          <div className="max-h-[90vh] w-full max-w-md overflow-y-auto rounded-xl bg-white p-6">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-lg font-bold">{cuenta.proveedor.nombre}</h2>
              <button onClick={cerrar} className="text-stone-400 hover:text-stone-700">
                <X size={18} aria-hidden />
              </button>
            </div>

            <div className="mb-4 rounded-lg bg-stone-50 p-3 text-sm">
              <div className="flex justify-between">
                <span>Se le debe actualmente</span>
                <span className="font-bold">{formatoMoneda.format(cuenta.proveedor.saldoPendiente)}</span>
              </div>
              {cuenta.proveedor.telefono && (
                <div className="flex justify-between text-stone-500">
                  <span>Teléfono</span>
                  <span>{cuenta.proveedor.telefono}</span>
                </div>
              )}
            </div>

            <div className="mb-3 rounded-lg border border-red-200 bg-red-50 p-3">
              <p className="mb-2 text-sm font-semibold text-red-800">Registrar deuda (compra a crédito)</p>
              <div className="flex flex-col gap-2">
                <input
                  type="number"
                  placeholder="Monto"
                  value={montoCargo}
                  onChange={(e) => setMontoCargo(e.target.value)}
                  className="rounded-lg border border-stone-300 px-3 py-2 text-sm"
                />
                <input
                  placeholder="Motivo (ej. mercancía recibida el...)"
                  value={motivoCargo}
                  onChange={(e) => setMotivoCargo(e.target.value)}
                  className="rounded-lg border border-stone-300 px-3 py-2 text-sm"
                />
              </div>
              <button onClick={registrarCargo} className="mt-2 w-full rounded-lg bg-red-700 py-2 text-sm font-semibold text-white hover:bg-red-800">
                Registrar deuda
              </button>
            </div>

            <div className="mb-4 rounded-lg border border-green-200 bg-green-50 p-3">
              <p className="mb-2 text-sm font-semibold text-green-800">Registrar pago</p>
              <div className="flex gap-2">
                <input
                  type="number"
                  placeholder="Monto"
                  value={montoPago}
                  onChange={(e) => setMontoPago(e.target.value)}
                  className="flex-1 rounded-lg border border-stone-300 px-3 py-2 text-sm"
                />
              </div>
              <button onClick={registrarPago} className="mt-2 w-full rounded-lg bg-green-700 py-2 text-sm font-semibold text-white hover:bg-green-800">
                Registrar pago
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
                      {m.motivo ? ` · ${m.motivo}` : ""}
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
