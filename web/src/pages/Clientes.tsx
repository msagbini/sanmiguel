import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ShieldCheck, ShieldAlert, Trash2 } from "lucide-react";
import { api, ApiError } from "../api";
import { useAuth } from "../AuthContext";
import { useToast } from "../Toast";
import type { Cliente, Codeudor, ReferenciaCliente, TipoCliente, TipoDocumentoCliente, TipoReferencia } from "../types";

const formatoMoneda = new Intl.NumberFormat("es-CO", { style: "currency", currency: "COP", maximumFractionDigits: 0 });

const MINIMO_CODEUDORES = 2;
const MINIMO_REFERENCIAS = 2;

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

const CODEUDOR_VACIO = {
  nombre: "",
  tipoDocumento: "CC" as TipoDocumentoCliente,
  numeroDocumento: "",
  telefono: "",
  direccion: "",
  parentesco: "",
};

const REFERENCIA_VACIA = {
  tipo: "PERSONAL" as TipoReferencia,
  nombre: "",
  telefono: "",
  relacion: "",
};

export function Clientes() {
  const { usuario } = useAuth();
  const { notificar } = useToast();
  const navigate = useNavigate();
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [busqueda, setBusqueda] = useState("");
  const [modalAbierto, setModalAbierto] = useState<Cliente | "nuevo" | null>(null);
  const [form, setForm] = useState(VACIO);
  const [detalle, setDetalle] = useState<Cliente | null>(null);
  const [formCodeudor, setFormCodeudor] = useState(CODEUDOR_VACIO);
  const [formReferencia, setFormReferencia] = useState(REFERENCIA_VACIA);
  const [montoAjuste, setMontoAjuste] = useState("");
  const [motivoAjuste, setMotivoAjuste] = useState("");
  const esAdmin = usuario?.rol === "ADMIN";

  async function cargar(q = "") {
    const data = await api.get<Cliente[]>(`/clientes${q ? `?buscar=${encodeURIComponent(q)}` : ""}`);
    setClientes(data.filter((c) => !c.esConsumidorFinal));
  }

  useEffect(() => {
    cargar();
  }, []);

  async function cargarDetalle(id: number) {
    const c = await api.get<Cliente>(`/clientes/${id}`);
    setDetalle(c);
    // El cupo puede haber cambiado en el servidor (p. ej. auto-revocado al
    // borrar un codeudor/referencia por debajo del mínimo); el formulario
    // siempre debe reflejar ese valor autoritativo, no uno que quedó viejo.
    setForm((f) => ({ ...f, limiteCredito: String(c.limiteCredito) }));
  }

  function abrir(c: Cliente | "nuevo") {
    if (c === "nuevo") {
      setForm(VACIO);
      setDetalle(null);
    } else {
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
      cargarDetalle(c.id);
    }
    setFormCodeudor(CODEUDOR_VACIO);
    setFormReferencia(REFERENCIA_VACIA);
    setMontoAjuste("");
    setMotivoAjuste("");
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
        notificar("Cliente creado. Para poder fiarle, primero registra el estudio de crédito desde Editar.", "exito");
        setModalAbierto(null);
      } else if (modalAbierto) {
        await api.put(`/clientes/${modalAbierto.id}`, data);
        notificar("Cliente actualizado", "exito");
        await cargarDetalle(modalAbierto.id);
      }
      cargar(busqueda);
    } catch (err) {
      notificar(err instanceof ApiError ? err.message : "No se pudo guardar el cliente", "error");
    }
  }

  async function agregarCodeudor() {
    if (!detalle) return;
    if (!formCodeudor.nombre.trim() || !formCodeudor.numeroDocumento.trim() || !formCodeudor.telefono.trim()) {
      notificar("Nombre, documento y teléfono del codeudor son obligatorios", "error");
      return;
    }
    try {
      await api.post(`/clientes/${detalle.id}/codeudores`, formCodeudor);
      setFormCodeudor(CODEUDOR_VACIO);
      await cargarDetalle(detalle.id);
      notificar("Codeudor agregado", "exito");
    } catch (err) {
      notificar(err instanceof ApiError ? err.message : "No se pudo agregar el codeudor", "error");
    }
  }

  async function borrarCodeudor(id: number) {
    if (!detalle) return;
    try {
      await api.delete(`/clientes/${detalle.id}/codeudores/${id}`);
      await cargarDetalle(detalle.id);
      cargar(busqueda);
    } catch (err) {
      notificar(err instanceof ApiError ? err.message : "No se pudo borrar el codeudor", "error");
    }
  }

  async function agregarReferencia() {
    if (!detalle) return;
    if (!formReferencia.nombre.trim() || !formReferencia.telefono.trim()) {
      notificar("Nombre y teléfono de la referencia son obligatorios", "error");
      return;
    }
    try {
      await api.post(`/clientes/${detalle.id}/referencias`, formReferencia);
      setFormReferencia(REFERENCIA_VACIA);
      await cargarDetalle(detalle.id);
      notificar("Referencia agregada", "exito");
    } catch (err) {
      notificar(err instanceof ApiError ? err.message : "No se pudo agregar la referencia", "error");
    }
  }

  async function borrarReferencia(id: number) {
    if (!detalle) return;
    try {
      await api.delete(`/clientes/${detalle.id}/referencias/${id}`);
      await cargarDetalle(detalle.id);
      cargar(busqueda);
    } catch (err) {
      notificar(err instanceof ApiError ? err.message : "No se pudo borrar la referencia", "error");
    }
  }

  async function aprobarEstudio() {
    if (!detalle) return;
    try {
      await api.post(`/clientes/${detalle.id}/estudio-credito/aprobar`, {});
      await cargarDetalle(detalle.id);
      cargar(busqueda);
      notificar("Estudio de crédito aprobado. Ya se puede asignar cupo de fiado.", "exito");
    } catch (err) {
      notificar(err instanceof ApiError ? err.message : "No se pudo aprobar el estudio", "error");
    }
  }

  async function revocarEstudio() {
    if (!detalle) return;
    try {
      await api.post(`/clientes/${detalle.id}/estudio-credito/revocar`, {});
      await cargarDetalle(detalle.id);
      setForm((f) => ({ ...f, limiteCredito: "0" }));
      cargar(busqueda);
      notificar("Estudio de crédito revocado. El cupo de fiado quedó en 0.", "exito");
    } catch (err) {
      notificar(err instanceof ApiError ? err.message : "No se pudo revocar el estudio", "error");
    }
  }

  async function registrarAjuste() {
    if (!detalle) return;
    const monto = Number(montoAjuste);
    if (!monto) {
      notificar("Ingresa un monto distinto de 0", "error");
      return;
    }
    if (!motivoAjuste.trim()) {
      notificar("Escribe el motivo del ajuste", "error");
      return;
    }
    try {
      await api.post(`/clientes/${detalle.id}/ajustes`, { monto, motivo: motivoAjuste });
      await cargarDetalle(detalle.id);
      cargar(busqueda);
      setMontoAjuste("");
      setMotivoAjuste("");
      notificar("Saldo ajustado", "exito");
    } catch (err) {
      notificar(err instanceof ApiError ? err.message : "No se pudo aplicar el ajuste", "error");
    }
  }

  const codeudores = detalle?.codeudores ?? [];
  const referencias = detalle?.referencias ?? [];
  const cumpleMinimos = codeudores.length >= MINIMO_CODEUDORES && referencias.length >= MINIMO_REFERENCIAS;

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
              <th className="px-3 py-2">Estudio de crédito</th>
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
                <td className="px-3 py-2">
                  {c.estudioCreditoAprobado ? (
                    <span className="flex items-center gap-1 text-xs font-semibold text-green-700">
                      <ShieldCheck size={14} /> Aprobado
                    </span>
                  ) : (
                    <span className="flex items-center gap-1 text-xs font-semibold text-stone-400">
                      <ShieldAlert size={14} /> Sin estudio
                    </span>
                  )}
                </td>
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
                <td colSpan={8} className="px-3 py-8 text-center text-stone-400">
                  Aún no hay clientes registrados
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {modalAbierto && (
        <div className="fixed inset-0 z-40 flex items-center justify-center overflow-y-auto bg-black/40 p-4">
          <div className="my-8 w-full max-w-lg rounded-xl bg-white p-6">
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
                    disabled={modalAbierto === "nuevo" || !detalle?.estudioCreditoAprobado}
                    onChange={(e) => setForm((f) => ({ ...f, limiteCredito: e.target.value }))}
                    className="mt-1 w-full rounded-lg border border-stone-300 px-3 py-2 disabled:bg-stone-100 disabled:text-stone-400"
                  />
                </label>
                {modalAbierto !== "nuevo" && !detalle?.estudioCreditoAprobado && (
                  <p className="mb-2 text-xs text-red-600">
                    Bloqueado: hay que completar y aprobar el estudio de crédito de abajo antes de poder ponerle cupo.
                  </p>
                )}
                {modalAbierto === "nuevo" && (
                  <p className="mb-2 text-xs text-stone-500">Guarda el cliente primero; el estudio de crédito se registra al editarlo.</p>
                )}
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

              {modalAbierto !== "nuevo" && detalle && esAdmin && (
                <div className="rounded-lg border border-stone-200 bg-stone-50 p-3">
                  <p className="mb-1 text-xs font-semibold uppercase text-stone-500">Ajuste manual de saldo</p>
                  <p className="mb-2 text-xs text-stone-500">
                    Para dejar registrada una deuda que ya existía antes de usar la app, o corregir un error. Debe
                    actual: {formatoMoneda.format(detalle.saldoPendiente)}. No abre cupo de fiado nuevo.
                  </p>
                  <div className="flex gap-2">
                    <input
                      type="number"
                      value={montoAjuste}
                      onChange={(e) => setMontoAjuste(e.target.value)}
                      placeholder="Monto (+ suma deuda, - la resta)"
                      className="w-40 rounded-lg border border-stone-300 px-2 py-1.5 text-xs"
                    />
                    <input
                      value={motivoAjuste}
                      onChange={(e) => setMotivoAjuste(e.target.value)}
                      placeholder="Motivo del ajuste..."
                      className="flex-1 rounded-lg border border-stone-300 px-2 py-1.5 text-xs"
                    />
                    <button
                      onClick={registrarAjuste}
                      type="button"
                      className="whitespace-nowrap rounded-lg bg-stone-700 px-3 py-1.5 text-xs font-semibold text-white hover:bg-stone-800"
                    >
                      Aplicar
                    </button>
                  </div>
                </div>
              )}

              {modalAbierto !== "nuevo" && detalle && (
                <div className="rounded-lg border border-stone-200 bg-stone-50 p-3">
                  <div className="mb-2 flex items-center justify-between">
                    <p className="text-xs font-semibold uppercase text-stone-500">Estudio de crédito para fiado</p>
                    {detalle.estudioCreditoAprobado ? (
                      <span className="flex items-center gap-1 text-xs font-bold text-green-700">
                        <ShieldCheck size={14} /> Aprobado
                      </span>
                    ) : (
                      <span className="flex items-center gap-1 text-xs font-bold text-red-600">
                        <ShieldAlert size={14} /> Pendiente
                      </span>
                    )}
                  </div>
                  <p className="mb-3 text-xs text-stone-500">
                    Requisito para poder fiarle: mínimo {MINIMO_CODEUDORES} codeudores y {MINIMO_REFERENCIAS} referencias
                    registrados, más la aprobación de un administrador. Además de esto, deben quedar firmados en físico el
                    pagaré y la carta de instrucciones antes de aprobar.
                  </p>

                  <p className="mb-1 text-xs font-semibold text-stone-600">
                    Codeudores ({codeudores.length}/{MINIMO_CODEUDORES} mínimo)
                  </p>
                  <div className="mb-2 flex flex-col gap-1">
                    {codeudores.map((cd: Codeudor) => (
                      <div key={cd.id} className="flex items-center justify-between rounded border border-stone-200 bg-white px-2 py-1 text-xs">
                        <span>
                          {cd.nombre} — {cd.tipoDocumento} {cd.numeroDocumento} — {cd.telefono}
                          {cd.parentesco ? ` (${cd.parentesco})` : ""}
                        </span>
                        {esAdmin && (
                          <button onClick={() => borrarCodeudor(cd.id)} className="text-red-600 hover:text-red-800">
                            <Trash2 size={14} />
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                  {esAdmin && (
                    <div className="mb-3 grid grid-cols-2 gap-1">
                      <input placeholder="Nombre" value={formCodeudor.nombre} onChange={(e) => setFormCodeudor((f) => ({ ...f, nombre: e.target.value }))} className="col-span-2 rounded border border-stone-300 px-2 py-1 text-xs" />
                      <input placeholder="N° documento" value={formCodeudor.numeroDocumento} onChange={(e) => setFormCodeudor((f) => ({ ...f, numeroDocumento: e.target.value }))} className="rounded border border-stone-300 px-2 py-1 text-xs" />
                      <input placeholder="Teléfono" value={formCodeudor.telefono} onChange={(e) => setFormCodeudor((f) => ({ ...f, telefono: e.target.value }))} className="rounded border border-stone-300 px-2 py-1 text-xs" />
                      <input placeholder="Dirección (opcional)" value={formCodeudor.direccion} onChange={(e) => setFormCodeudor((f) => ({ ...f, direccion: e.target.value }))} className="rounded border border-stone-300 px-2 py-1 text-xs" />
                      <input placeholder="Parentesco (opcional)" value={formCodeudor.parentesco} onChange={(e) => setFormCodeudor((f) => ({ ...f, parentesco: e.target.value }))} className="rounded border border-stone-300 px-2 py-1 text-xs" />
                      <button onClick={agregarCodeudor} className="col-span-2 rounded bg-stone-200 py-1 text-xs font-semibold hover:bg-stone-300">
                        + Agregar codeudor
                      </button>
                    </div>
                  )}

                  <p className="mb-1 text-xs font-semibold text-stone-600">
                    Referencias ({referencias.length}/{MINIMO_REFERENCIAS} mínimo)
                  </p>
                  <div className="mb-2 flex flex-col gap-1">
                    {referencias.map((r: ReferenciaCliente) => (
                      <div key={r.id} className="flex items-center justify-between rounded border border-stone-200 bg-white px-2 py-1 text-xs">
                        <span>
                          {r.tipo === "COMERCIAL" ? "Comercial" : "Personal"}: {r.nombre} — {r.telefono}
                          {r.relacion ? ` (${r.relacion})` : ""}
                        </span>
                        {esAdmin && (
                          <button onClick={() => borrarReferencia(r.id)} className="text-red-600 hover:text-red-800">
                            <Trash2 size={14} />
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                  {esAdmin && (
                    <div className="mb-3 grid grid-cols-2 gap-1">
                      <select
                        value={formReferencia.tipo}
                        onChange={(e) => setFormReferencia((f) => ({ ...f, tipo: e.target.value as TipoReferencia }))}
                        className="col-span-2 rounded border border-stone-300 px-2 py-1 text-xs"
                      >
                        <option value="PERSONAL">Referencia personal</option>
                        <option value="COMERCIAL">Referencia comercial</option>
                      </select>
                      <input placeholder="Nombre" value={formReferencia.nombre} onChange={(e) => setFormReferencia((f) => ({ ...f, nombre: e.target.value }))} className="rounded border border-stone-300 px-2 py-1 text-xs" />
                      <input placeholder="Teléfono" value={formReferencia.telefono} onChange={(e) => setFormReferencia((f) => ({ ...f, telefono: e.target.value }))} className="rounded border border-stone-300 px-2 py-1 text-xs" />
                      <input placeholder="Relación (opcional)" value={formReferencia.relacion} onChange={(e) => setFormReferencia((f) => ({ ...f, relacion: e.target.value }))} className="col-span-2 rounded border border-stone-300 px-2 py-1 text-xs" />
                      <button onClick={agregarReferencia} className="col-span-2 rounded bg-stone-200 py-1 text-xs font-semibold hover:bg-stone-300">
                        + Agregar referencia
                      </button>
                    </div>
                  )}

                  {esAdmin && (
                    <div className="flex gap-2">
                      {!detalle.estudioCreditoAprobado ? (
                        <button
                          onClick={aprobarEstudio}
                          disabled={!cumpleMinimos}
                          className="flex-1 rounded-lg bg-green-700 py-2 text-sm font-semibold text-white hover:bg-green-800 disabled:cursor-not-allowed disabled:bg-stone-300"
                        >
                          Aprobar estudio de crédito
                        </button>
                      ) : (
                        <button onClick={revocarEstudio} className="flex-1 rounded-lg bg-red-700 py-2 text-sm font-semibold text-white hover:bg-red-800">
                          Revocar aprobación
                        </button>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>
            <div className="mt-5 flex gap-2">
              <button onClick={guardar} className="flex-1 rounded-lg btn-primary py-2.5">
                Guardar
              </button>
              <button onClick={() => setModalAbierto(null)} className="flex-1 rounded-lg bg-stone-200 py-2.5 font-semibold">
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
