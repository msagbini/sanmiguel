import { useEffect, useState } from "react";
import { api, ApiError } from "../api";
import { useToast } from "../Toast";
import type { Configuracion as ConfiguracionType, Rol, Usuario } from "../types";

export function Configuracion() {
  const { notificar } = useToast();
  const [config, setConfig] = useState<ConfiguracionType | null>(null);
  const [nuevoSecreto, setNuevoSecreto] = useState("");
  const [guardando, setGuardando] = useState(false);

  useEffect(() => {
    api.get<ConfiguracionType>("/configuracion").then(setConfig);
  }, []);

  function set<K extends keyof ConfiguracionType>(campo: K, valor: ConfiguracionType[K]) {
    setConfig((c) => (c ? { ...c, [campo]: valor } : c));
  }

  async function guardar() {
    if (!config) return;
    setGuardando(true);
    try {
      const actualizado = await api.put<ConfiguracionType>("/configuracion", {
        ...config,
        ...(nuevoSecreto ? { proveedorApiSecret: nuevoSecreto } : {}),
      });
      setConfig(actualizado);
      setNuevoSecreto("");
      notificar("Configuración guardada", "exito");
    } catch (err) {
      notificar(err instanceof ApiError ? err.message : "No se pudo guardar", "error");
    } finally {
      setGuardando(false);
    }
  }

  if (!config) return <div className="p-4 text-stone-500">Cargando...</div>;

  return (
    <div className="mx-auto max-w-3xl p-4">
      <h1 className="mb-4 text-xl font-bold text-stone-800">Configuración</h1>

      <Seccion titulo="Datos del negocio">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Campo label="Nombre del negocio">
            <input value={config.nombreNegocio} onChange={(e) => set("nombreNegocio", e.target.value)} className="input" />
          </Campo>
          <Campo label="NIT">
            <input value={config.nit ?? ""} onChange={(e) => set("nit", e.target.value)} className="input" />
          </Campo>
          <Campo label="Dirección" className="sm:col-span-2">
            <input value={config.direccion} onChange={(e) => set("direccion", e.target.value)} className="input" />
          </Campo>
          <Campo label="Ciudad">
            <input value={config.ciudad} onChange={(e) => set("ciudad", e.target.value)} className="input" />
          </Campo>
          <Campo label="Teléfono">
            <input value={config.telefono ?? ""} onChange={(e) => set("telefono", e.target.value)} className="input" />
          </Campo>
          <Campo label="Formato de recibo (impresora térmica)">
            <select value={config.formatoRecibo} onChange={(e) => set("formatoRecibo", e.target.value as "58MM" | "80MM")} className="input">
              <option value="58MM">58mm</option>
              <option value="80MM">80mm</option>
            </select>
          </Campo>
        </div>
      </Seccion>

      <Seccion
        titulo="Facturación electrónica DIAN"
        descripcion="Mientras esto esté apagado, las ventas se emiten como documento equivalente POS (válido para el día a día pero no es factura electrónica). Actívalo cuando tengan una cuenta con un proveedor tecnológico autorizado por la DIAN."
      >
        <label className="mb-3 flex items-center gap-2 text-sm font-medium">
          <input
            type="checkbox"
            checked={config.facturacionElectronicaHabilitada}
            onChange={(e) => set("facturacionElectronicaHabilitada", e.target.checked)}
          />
          Habilitar facturación electrónica DIAN
        </label>

        {config.facturacionElectronicaHabilitada && (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Campo label="Proveedor tecnológico">
              <select
                value={config.proveedorFacturacion}
                onChange={(e) => set("proveedorFacturacion", e.target.value as "NINGUNO" | "FACTUS")}
                className="input"
              >
                <option value="NINGUNO">Ninguno</option>
                <option value="FACTUS">Factus</option>
              </select>
            </Campo>
            <Campo label="URL de la API del proveedor">
              <input value={config.proveedorApiUrl ?? ""} onChange={(e) => set("proveedorApiUrl", e.target.value)} placeholder="https://api.factus.com.co" className="input" />
            </Campo>
            <Campo label="Client ID / API Key">
              <input value={config.proveedorApiKey ?? ""} onChange={(e) => set("proveedorApiKey", e.target.value)} className="input" />
            </Campo>
            <Campo label={`Client Secret ${config.proveedorApiSecretConfigurado ? "(ya configurado, deja vacío para no cambiarlo)" : ""}`}>
              <input
                type="password"
                value={nuevoSecreto}
                onChange={(e) => setNuevoSecreto(e.target.value)}
                placeholder={config.proveedorApiSecretConfigurado ? "••••••••" : ""}
                className="input"
              />
            </Campo>
            <Campo label="Prefijo / resolución de numeración DIAN">
              <input value={config.resolucionDianPrefijo ?? ""} onChange={(e) => set("resolucionDianPrefijo", e.target.value)} className="input" />
            </Campo>
            <Campo label="Número de resolución">
              <input value={config.resolucionDianNumero ?? ""} onChange={(e) => set("resolucionDianNumero", e.target.value)} className="input" />
            </Campo>
          </div>
        )}
      </Seccion>

      <button onClick={guardar} disabled={guardando} className="mb-8 rounded-lg bg-orange-800 px-6 py-2.5 font-semibold text-white hover:bg-orange-900 disabled:opacity-50">
        {guardando ? "Guardando..." : "Guardar configuración"}
      </button>

      <UsuariosPanel />
    </div>
  );
}

function Seccion({ titulo, descripcion, children }: { titulo: string; descripcion?: string; children: React.ReactNode }) {
  return (
    <div className="mb-6 rounded-lg border border-stone-200 bg-white p-4">
      <h2 className="text-base font-bold text-stone-800">{titulo}</h2>
      {descripcion && <p className="mb-3 mt-1 text-xs text-stone-500">{descripcion}</p>}
      <div className={descripcion ? "" : "mt-3"}>{children}</div>
    </div>
  );
}

function Campo({ label, children, className }: { label: string; children: React.ReactNode; className?: string }) {
  return (
    <label className={`text-sm ${className ?? ""}`}>
      {label}
      <div className="mt-1">{children}</div>
    </label>
  );
}

function UsuariosPanel() {
  const { notificar } = useToast();
  const [usuarios, setUsuarios] = useState<Usuario[]>([]);
  const [nombre, setNombre] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [rol, setRol] = useState<Rol>("CAJERO");

  function cargar() {
    api.get<Usuario[]>("/usuarios").then(setUsuarios);
  }

  useEffect(cargar, []);

  async function crear() {
    if (!nombre || !email || password.length < 6) {
      notificar("Nombre, email y contraseña (mín. 6 caracteres) son obligatorios", "error");
      return;
    }
    try {
      await api.post("/usuarios", { nombre, email, password, rol });
      notificar("Usuario creado", "exito");
      setNombre("");
      setEmail("");
      setPassword("");
      cargar();
    } catch (err) {
      notificar(err instanceof ApiError ? err.message : "No se pudo crear el usuario", "error");
    }
  }

  async function toggleActivo(u: Usuario) {
    await api.put(`/usuarios/${u.id}`, { activo: !u.activo });
    cargar();
  }

  return (
    <Seccion titulo="Usuarios (cajeros y administradores)">
      <div className="mb-4 overflow-hidden rounded-lg border border-stone-100">
        {usuarios.map((u) => (
          <div key={u.id} className="flex items-center justify-between border-b border-stone-100 px-3 py-2 text-sm last:border-0">
            <div>
              <p className="font-medium">{u.nombre} <span className="text-xs text-stone-400">({u.rol === "ADMIN" ? "Administrador" : "Cajero"})</span></p>
              <p className="text-xs text-stone-400">{u.email}</p>
            </div>
            <button onClick={() => toggleActivo(u)} className={`text-xs font-semibold underline ${u.activo ? "text-red-700" : "text-green-700"}`}>
              {u.activo ? "Desactivar" : "Activar"}
            </button>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 gap-2 sm:grid-cols-4">
        <input placeholder="Nombre" value={nombre} onChange={(e) => setNombre(e.target.value)} className="input" />
        <input placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} className="input" />
        <input placeholder="Contraseña" type="password" value={password} onChange={(e) => setPassword(e.target.value)} className="input" />
        <select value={rol} onChange={(e) => setRol(e.target.value as Rol)} className="input">
          <option value="CAJERO">Cajero</option>
          <option value="ADMIN">Administrador</option>
        </select>
      </div>
      <button onClick={crear} className="mt-2 rounded-lg bg-stone-800 px-4 py-2 text-sm font-semibold text-white hover:bg-stone-900">
        + Crear usuario
      </button>
    </Seccion>
  );
}
