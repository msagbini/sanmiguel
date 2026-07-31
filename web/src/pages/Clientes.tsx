import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api, ApiError } from "../api";
import { useToast } from "../Toast";
import type { Cliente, TipoCliente, TipoDocumentoCliente } from "../types";

const formatoMoneda = new Intl.NumberFormat("es-CO", { style: "currency", currency: "COP", maximumFractionDigits: 0 });

const VACIO = {
  tipoDocumento: "CC" as TipoDocumentoCliente,
  numeroDocumento: "",
  nombre: "",
  telefono: "",
  email: "",
  direccion: "",
  tipoCliente: "DETAL" as TipoCliente,
  limiteCredito: "0",
  diasPlazoCredito: "30",
};

export function Clientes() {
  const { notificar } = useToast();
  const navigate = useNavigate();
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [busqueda, setBusqueda] = useState("");
  const [modalAbierto, setModalAbierto] = useState<Cliente | "nuevo" | null>(null);
  const [form, setForm] = useState(VACIO);

  async function cargar(q = "") {
    const data = await api.get<Cliente[]>(`/clientes${q ? `?buscar=${encodeURIComponent(q)}` : ""}`);
    setClientes(data.filter((c) => !c.esConsumidorFinal));
  }

  useEffect(() => {
    cargar();
  }, []);

  function abrir(c: Cliente | "nuevo") {
    if (c === "nuevo") setForm(VACIO);
    else
      setForm({
        tipoDocumento: c.tipoDocumento,
        numeroDocumento: c.numeroDocumento,
        nombre: c.nombre,
        telefono: c.telefono ?? "",
        email: c.email ?? "",
        direccion: c.direccion ?? "",
        tipoCliente: c.tipoCliente,
        limiteCredito: String(c.limiteCredito),
        diasPlazoCredito: String(c.diasPlazoCredito),
      });
    setModalAbierto(c);
  }

  async function guardar() {
    if (!form.nombre.trim() || !form.numeroDocumento.trim()) {
      notificar("Nombre y documento son obligatorios", "error");
      return;
    }
    const data = {
      ...form,
      limiteCredito: Number(form.limiteCredito) || 0,
      diasPlazoCredito: Number(form.diasPlazoCredito) || 30,
    };
    try {
      if (modalAbierto === "nuevo") {
        await api.post("/clientes", data);
        notificar("Cliente creado", "exito");
      } else if (modalAbierto) {
        await api.put(`/clientes/${modalAbierto.id}`, data);
        notificar("Cliente actualizado", "exito");
      }
      setModalAbierto(null);
      cargar(busqueda);
    } catch (err) {
      notificar(err instanceof ApiError ? err.message : "No se pudo guardar el cliente", "error");
    }
  }

  return (
    <div className="p-4">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-xl font-bold text-stone-800">Clientes</h1>
        <button onClick={() => abrir("nuevo")} className="rounded-lg btn-primary px-4 py-2">
          + Nuevo cliente
        </button>
      </div>

      <input
        value={busqueda}
        onChange={(e) => {
          setBusqueda(e.target.value);
          cargar(e.target.value);
        }}
        placeholder="Buscar por nombre o documento..."
        className="mb-4 w-full max-w-md rounded-lg border border-stone-300 px-3 py-2"
      />

      <div className="overflow-x-auto rounded-lg border border-stone-200 bg-white">
        <table className="w-full text-sm">
          <thead className="bg-stone-50 text-left text-xs uppercase text-stone-500">
            <tr>
              <th className="px-3 py-2">Nombre</th>
              <th className="px-3 py-2">Documento</th>
              <th className="px-3 py-2">Tipo</th>
              <th className="px-3 py-2">Teléfono</th>
              <th className="px-3 py-2">Cupo de fiado</th>
              <th className="px-3 py-2">Debe</th>
              <th className="px-3 py-2"></th>
            </tr>
          </thead>
          <tbody>
            {clientes.map((c) => (
              <tr key={c.id} className="border-t border-stone-100">
                <td className="px-3 py-2 font-medium">{c.nombre}</td>
                <td className="px-3 py-2">
                  {c.tipoDocumento} {c.numeroDocumento}
                </td>
                <td className="px-3 py-2">
                  {c.tipoCliente === "MAYORISTA" ? (
                    <span className="rounded-full bg-blue-100 px-2 py-0.5 text-xs font-semibold text-blue-700">Mayorista</span>
                  ) : (
                    <span className="text-xs text-stone-400">Detal</span>
                  )}
                </td>
                <td className="px-3 py-2">{c.telefono ?? "-"}</td>
                <td className="px-3 py-2">{c.limiteCredito > 0 ? formatoMoneda.format(c.limiteCredito) : "No fía"}</td>
                <td className={`px-3 py-2 font-semibold ${c.saldoPendiente > 0 ? "text-red-600" : ""}`}>
                  {c.saldoPendiente > 0 ? formatoMoneda.format(c.saldoPendiente) : "-"}
                </td>
                <td className="px-3 py-2">
                  <div className="flex gap-2 whitespace-nowrap">
                    <button onClick={() => abrir(c)} className="text-xs font-semibold text-brand-700 underline">
                      Editar
                    </button>
                    {c.limiteCredito > 0 && (
                      <button onClick={() => navigate(`/cartera?cliente=${c.id}`)} className="text-xs font-semibold text-blue-800 underline">
                        Ver cuenta
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
            {clientes.length === 0 && (
              <tr>
                <td colSpan={7} className="px-3 py-8 text-center text-stone-400">
                  Aún no hay clientes registrados
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {modalAbierto && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-sm rounded-xl bg-white p-6">
            <h2 className="mb-4 text-lg font-bold">{modalAbierto === "nuevo" ? "Nuevo cliente" : "Editar cliente"}</h2>
            <div className="flex flex-col gap-3">
              <select
                value={form.tipoDocumento}
                onChange={(e) => setForm((f) => ({ ...f, tipoDocumento: e.target.value as TipoDocumentoCliente }))}
                className="rounded-lg border border-stone-300 px-3 py-2"
              >
                <option value="CC">Cédula</option>
                <option value="NIT">NIT</option>
                <option value="CE">Cédula extranjería</option>
                <option value="PASAPORTE">Pasaporte</option>
              </select>
              <input placeholder="Número de documento" value={form.numeroDocumento} onChange={(e) => setForm((f) => ({ ...f, numeroDocumento: e.target.value }))} className="rounded-lg border border-stone-300 px-3 py-2" />
              <input placeholder="Nombre completo" value={form.nombre} onChange={(e) => setForm((f) => ({ ...f, nombre: e.target.value }))} className="rounded-lg border border-stone-300 px-3 py-2" />
              <input placeholder="Teléfono" value={form.telefono} onChange={(e) => setForm((f) => ({ ...f, telefono: e.target.value }))} className="rounded-lg border border-stone-300 px-3 py-2" />
              <input placeholder="Email (opcional)" value={form.email} onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))} className="rounded-lg border border-stone-300 px-3 py-2" />
              <input placeholder="Dirección (opcional)" value={form.direccion} onChange={(e) => setForm((f) => ({ ...f, direccion: e.target.value }))} className="rounded-lg border border-stone-300 px-3 py-2" />

              <div className="rounded-lg border border-stone-200 bg-stone-50 p-3">
                <p className="mb-2 text-xs font-semibold uppercase text-stone-500">Tipo de cliente y fiado</p>
                <select
                  value={form.tipoCliente}
                  onChange={(e) => setForm((f) => ({ ...f, tipoCliente: e.target.value as TipoCliente }))}
                  className="mb-2 w-full rounded-lg border border-stone-300 px-3 py-2"
                >
                  <option value="DETAL">Detal (precio normal)</option>
                  <option value="MAYORISTA">Mayorista / tendero (precio mayorista)</option>
                </select>
                <label className="mb-2 block text-sm">
                  Cupo máximo de fiado (0 = no se le fía)
                  <input
                    type="number"
                    value={form.limiteCredito}
                    onChange={(e) => setForm((f) => ({ ...f, limiteCredito: e.target.value }))}
                    className="mt-1 w-full rounded-lg border border-stone-300 px-3 py-2"
                  />
                </label>
                <label className="block text-sm">
                  Días de plazo para pagar
                  <input
                    type="number"
                    value={form.diasPlazoCredito}
                    onChange={(e) => setForm((f) => ({ ...f, diasPlazoCredito: e.target.value }))}
                    className="mt-1 w-full rounded-lg border border-stone-300 px-3 py-2"
                  />
                </label>
              </div>
            </div>
            <div className="mt-5 flex gap-2">
              <button onClick={guardar} className="flex-1 rounded-lg btn-primary py-2.5">
                Guardar
              </button>
              <button onClick={() => setModalAbierto(null)} className="flex-1 rounded-lg bg-stone-200 py-2.5 font-semibold">
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
