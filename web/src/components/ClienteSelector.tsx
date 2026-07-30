import { useState } from "react";
import { api, ApiError } from "../api";
import type { Cliente, TipoDocumentoCliente } from "../types";
import { useToast } from "../Toast";

export function ClienteSelector({
  cliente,
  onChange,
}: {
  cliente: Cliente | null;
  onChange: (cliente: Cliente | null) => void;
}) {
  const { notificar } = useToast();
  const [abierto, setAbierto] = useState(false);
  const [documento, setDocumento] = useState("");
  const [resultados, setResultados] = useState<Cliente[]>([]);
  const [creando, setCreando] = useState(false);
  const [nuevo, setNuevo] = useState({
    tipoDocumento: "CC" as TipoDocumentoCliente,
    numeroDocumento: "",
    nombre: "",
    telefono: "",
  });

  async function buscar(valor: string) {
    setDocumento(valor);
    if (valor.trim().length < 2) {
      setResultados([]);
      return;
    }
    try {
      const res = await api.get<Cliente[]>(`/clientes?buscar=${encodeURIComponent(valor)}`);
      setResultados(res);
    } catch {
      // silencioso: la búsqueda de clientes no debe interrumpir el flujo de venta
    }
  }

  async function crearCliente() {
    try {
      const cliente = await api.post<Cliente>("/clientes", nuevo);
      onChange(cliente);
      setAbierto(false);
      setCreando(false);
      notificar("Cliente registrado", "exito");
    } catch (err) {
      notificar(err instanceof ApiError ? err.message : "No se pudo crear el cliente", "error");
    }
  }

  if (!abierto) {
    return (
      <button
        type="button"
        onClick={() => setAbierto(true)}
        className="w-full rounded-lg border border-stone-300 bg-white px-3 py-2 text-left text-sm hover:bg-stone-50"
      >
        <span className="text-stone-500">Cliente: </span>
        <span className="font-medium">{cliente?.nombre ?? "Consumidor Final"}</span>
      </button>
    );
  }

  return (
    <div className="rounded-lg border border-stone-300 bg-white p-3 text-sm">
      <div className="mb-2 flex items-center justify-between">
        <p className="font-semibold">Seleccionar cliente</p>
        <button onClick={() => setAbierto(false)} className="text-stone-400 hover:text-stone-700">
          ✕
        </button>
      </div>

      {!creando ? (
        <>
          <input
            autoFocus
            placeholder="Buscar por nombre o documento..."
            value={documento}
            onChange={(e) => buscar(e.target.value)}
            className="mb-2 w-full rounded border border-stone-300 px-2 py-1.5"
          />
          <button
            type="button"
            onClick={() => {
              onChange(null);
              setAbierto(false);
            }}
            className="mb-1 block w-full rounded px-2 py-1.5 text-left hover:bg-stone-100"
          >
            Consumidor Final
          </button>
          <div className="max-h-40 overflow-y-auto">
            {resultados.map((c) => (
              <button
                key={c.id}
                type="button"
                onClick={() => {
                  onChange(c);
                  setAbierto(false);
                }}
                className="block w-full rounded px-2 py-1.5 text-left hover:bg-stone-100"
              >
                {c.nombre} <span className="text-stone-400">({c.numeroDocumento})</span>
              </button>
            ))}
          </div>
          <button
            type="button"
            onClick={() => {
              setNuevo((n) => ({ ...n, numeroDocumento: documento }));
              setCreando(true);
            }}
            className="mt-2 text-xs font-semibold text-orange-800 underline"
          >
            + Registrar cliente nuevo
          </button>
        </>
      ) : (
        <div className="flex flex-col gap-2">
          <select
            value={nuevo.tipoDocumento}
            onChange={(e) => setNuevo((n) => ({ ...n, tipoDocumento: e.target.value as TipoDocumentoCliente }))}
            className="rounded border border-stone-300 px-2 py-1.5"
          >
            <option value="CC">Cédula</option>
            <option value="NIT">NIT</option>
            <option value="CE">Cédula extranjería</option>
            <option value="PASAPORTE">Pasaporte</option>
          </select>
          <input
            placeholder="Número de documento"
            value={nuevo.numeroDocumento}
            onChange={(e) => setNuevo((n) => ({ ...n, numeroDocumento: e.target.value }))}
            className="rounded border border-stone-300 px-2 py-1.5"
          />
          <input
            placeholder="Nombre completo"
            value={nuevo.nombre}
            onChange={(e) => setNuevo((n) => ({ ...n, nombre: e.target.value }))}
            className="rounded border border-stone-300 px-2 py-1.5"
          />
          <input
            placeholder="Teléfono (opcional)"
            value={nuevo.telefono}
            onChange={(e) => setNuevo((n) => ({ ...n, telefono: e.target.value }))}
            className="rounded border border-stone-300 px-2 py-1.5"
          />
          <div className="flex gap-2">
            <button
              onClick={crearCliente}
              disabled={!nuevo.numeroDocumento || !nuevo.nombre}
              className="flex-1 rounded bg-orange-800 py-1.5 font-semibold text-white disabled:opacity-50"
            >
              Guardar
            </button>
            <button onClick={() => setCreando(false)} className="flex-1 rounded bg-stone-200 py-1.5">
              Cancelar
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
