import { useEffect, useState } from "react";
import { api, ApiError } from "../api";
import { useToast } from "../Toast";
import type { Cliente, TipoDocumentoCliente } from "../types";

const VACIO = { tipoDocumento: "CC" as TipoDocumentoCliente, numeroDocumento: "", nombre: "", telefono: "", email: "", direccion: "" };

export function Clientes() {
  const { notificar } = useToast();
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
      });
    setModalAbierto(c);
  }

  async function guardar() {
    if (!form.nombre.trim() || !form.numeroDocumento.trim()) {
      notificar("Nombre y documento son obligatorios", "error");
      return;
    }
    try {
      if (modalAbierto === "nuevo") {
        await api.post("/clientes", form);
        notificar("Cliente creado", "exito");
      } else if (modalAbierto) {
        await api.put(`/clientes/${modalAbierto.id}`, form);
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
        <button onClick={() => abrir("nuevo")} className="rounded-lg bg-orange-800 px-4 py-2 font-semibold text-white hover:bg-orange-900">
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
              <th className="px-3 py-2">Teléfono</th>
              <th className="px-3 py-2">Email</th>
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
                <td className="px-3 py-2">{c.telefono ?? "-"}</td>
                <td className="px-3 py-2">{c.email ?? "-"}</td>
                <td className="px-3 py-2">
                  <button onClick={() => abrir(c)} className="text-xs font-semibold text-orange-800 underline">
                    Editar
                  </button>
                </td>
              </tr>
            ))}
            {clientes.length === 0 && (
              <tr>
                <td colSpan={5} className="px-3 py-8 text-center text-stone-400">
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
            </div>
            <div className="mt-5 flex gap-2">
              <button onClick={guardar} className="flex-1 rounded-lg bg-orange-800 py-2.5 font-semibold text-white hover:bg-orange-900">
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
