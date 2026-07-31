import { useState } from "react";
import { PackagePlus, X } from "lucide-react";
import { api, ApiError } from "../api";
import { useToast } from "../Toast";
import { useBarcodeScanner } from "../hooks/useBarcodeScanner";
import { beepExito, beepError } from "../sonido";
import type { Categoria, Producto } from "../types";
import { UNIDAD_LABELS } from "../types";

const PRODUCTO_NUEVO_VACIO = {
  nombre: "",
  categoriaId: "" as number | "",
  precioCosto: "",
  precioVenta: "",
  ivaTasa: 19,
};

// Pensada para cuando llega el pedido del proveedor: se escanea (o se busca)
// cada producto, uno tras otro, y se le suma la cantidad recibida al
// inventario sin salir de esta pantalla. Si el producto no existe todavía en
// el catálogo, se crea al vuelo con el código ya escaneado.
export function RecepcionMercancia({ categorias, onCerrar, onCambios }: { categorias: Categoria[]; onCerrar: () => void; onCambios: () => void }) {
  const { notificar } = useToast();
  const [productoActivo, setProductoActivo] = useState<Producto | null>(null);
  const [codigoNoEncontrado, setCodigoNoEncontrado] = useState<string | null>(null);
  const [cantidad, setCantidad] = useState("1");
  const [costoUnitario, setCostoUnitario] = useState("");
  const [fechaVencimiento, setFechaVencimiento] = useState("");
  const [nuevoProducto, setNuevoProducto] = useState(PRODUCTO_NUEVO_VACIO);
  const [historial, setHistorial] = useState<string[]>([]);

  async function manejarEscaneo(codigo: string) {
    try {
      const producto = await api.get<Producto>(`/productos/codigo/${encodeURIComponent(codigo)}`);
      beepExito();
      setProductoActivo(producto);
      setCodigoNoEncontrado(null);
      setCostoUnitario(String(producto.precioCosto || ""));
      setCantidad("1");
    } catch {
      beepError();
      setProductoActivo(null);
      setCodigoNoEncontrado(codigo);
      setNuevoProducto({ ...PRODUCTO_NUEVO_VACIO });
    }
  }

  const { inputProps } = useBarcodeScanner(manejarEscaneo);

  async function confirmarEntrada() {
    if (!productoActivo || !cantidad) return;
    try {
      await api.post(`/productos/${productoActivo.id}/ajuste`, {
        tipo: "ENTRADA",
        cantidad: Number(cantidad),
        costoUnitario: costoUnitario ? Number(costoUnitario) : undefined,
        fechaVencimiento: fechaVencimiento || undefined,
        motivo: "Recepción de mercancía",
      });
      setHistorial((h) => [`+${cantidad} ${productoActivo.nombre}`, ...h].slice(0, 8));
      notificar(`${productoActivo.nombre}: +${cantidad}`, "exito");
      setProductoActivo(null);
      setCantidad("1");
      setCostoUnitario("");
      setFechaVencimiento("");
      onCambios();
    } catch (err) {
      notificar(err instanceof ApiError ? err.message : "No se pudo registrar la entrada", "error");
    }
  }

  async function crearYRecibir() {
    if (!codigoNoEncontrado || !nuevoProducto.nombre || !nuevoProducto.precioVenta) return;
    try {
      const producto = await api.post<Producto>("/productos", {
        codigoBarras: codigoNoEncontrado,
        nombre: nuevoProducto.nombre,
        categoriaId: nuevoProducto.categoriaId || null,
        precioCosto: Number(nuevoProducto.precioCosto) || 0,
        precioVenta: Number(nuevoProducto.precioVenta),
        ivaTasa: Number(nuevoProducto.ivaTasa),
        stock: 0,
      });
      setHistorial((h) => [`Nuevo: ${producto.nombre}`, ...h].slice(0, 8));
      notificar(`${producto.nombre} creado. Ahora ingresa la cantidad recibida.`, "exito");
      setCodigoNoEncontrado(null);
      setProductoActivo(producto);
      setCostoUnitario(String(producto.precioCosto || ""));
      onCambios();
    } catch (err) {
      notificar(err instanceof ApiError ? err.message : "No se pudo crear el producto", "error");
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-brand-950 text-white">
      <div className="flex items-center justify-between border-b border-brand-800 px-4 py-3">
        <span className="flex items-center gap-2 text-lg font-bold">
          <PackagePlus size={22} className="text-gold-400" /> Recepción de mercancía
        </span>
        <button onClick={onCerrar} className="rounded-full p-2 hover:bg-brand-800">
          <X size={22} />
        </button>
      </div>

      <div className="mx-auto w-full max-w-lg flex-1 overflow-y-auto p-4">
        <input
          {...inputProps}
          autoFocus
          placeholder="Escanea el código de barras del producto que llegó..."
          className="mb-4 w-full rounded-lg border-2 border-gold-500 bg-white px-4 py-3 text-lg text-stone-900 focus:outline-none"
        />

        {productoActivo && (
          <div className="rounded-xl bg-white p-4 text-stone-800">
            <p className="text-sm text-stone-500">Producto</p>
            <p className="mb-3 text-lg font-bold">{productoActivo.nombre}</p>
            <p className="mb-3 text-sm text-stone-500">
              Stock actual: {productoActivo.stock} {UNIDAD_LABELS[productoActivo.unidad]}
            </p>
            <div className="grid grid-cols-2 gap-3">
              <label className="text-sm">
                Cantidad recibida
                <input type="number" autoFocus value={cantidad} onChange={(e) => setCantidad(e.target.value)} className="input mt-1" />
              </label>
              <label className="text-sm">
                Costo unitario
                <input type="number" value={costoUnitario} onChange={(e) => setCostoUnitario(e.target.value)} className="input mt-1" />
              </label>
              <label className="col-span-2 text-sm">
                Fecha de vencimiento (opcional)
                <input type="date" value={fechaVencimiento} onChange={(e) => setFechaVencimiento(e.target.value)} className="input mt-1" />
              </label>
            </div>
            <div className="mt-4 flex gap-2">
              <button onClick={confirmarEntrada} className="btn-primary flex-1 py-2.5">
                Agregar al inventario
              </button>
              <button onClick={() => setProductoActivo(null)} className="flex-1 rounded-lg bg-stone-200 py-2.5 font-semibold">
                Cancelar
              </button>
            </div>
          </div>
        )}

        {codigoNoEncontrado && (
          <div className="rounded-xl bg-white p-4 text-stone-800">
            <p className="mb-1 text-sm text-stone-500">Código escaneado: {codigoNoEncontrado}</p>
            <p className="mb-3 font-bold text-amber-700">Este producto no existe todavía. Créalo:</p>
            <div className="grid grid-cols-2 gap-3">
              <label className="col-span-2 text-sm">
                Nombre
                <input
                  autoFocus
                  value={nuevoProducto.nombre}
                  onChange={(e) => setNuevoProducto((f) => ({ ...f, nombre: e.target.value }))}
                  className="input mt-1"
                />
              </label>
              <label className="col-span-2 text-sm">
                Categoría
                <select
                  value={nuevoProducto.categoriaId}
                  onChange={(e) => setNuevoProducto((f) => ({ ...f, categoriaId: e.target.value ? Number(e.target.value) : "" }))}
                  className="input mt-1"
                >
                  <option value="">Sin categoría</option>
                  {categorias.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.nombre}
                    </option>
                  ))}
                </select>
              </label>
              <label className="text-sm">
                Costo
                <input type="number" value={nuevoProducto.precioCosto} onChange={(e) => setNuevoProducto((f) => ({ ...f, precioCosto: e.target.value }))} className="input mt-1" />
              </label>
              <label className="text-sm">
                Precio de venta
                <input type="number" value={nuevoProducto.precioVenta} onChange={(e) => setNuevoProducto((f) => ({ ...f, precioVenta: e.target.value }))} className="input mt-1" />
              </label>
              <label className="col-span-2 text-sm">
                IVA
                <select value={nuevoProducto.ivaTasa} onChange={(e) => setNuevoProducto((f) => ({ ...f, ivaTasa: Number(e.target.value) }))} className="input mt-1">
                  <option value={0}>0%</option>
                  <option value={5}>5%</option>
                  <option value={19}>19%</option>
                </select>
              </label>
            </div>
            <div className="mt-4 flex gap-2">
              <button onClick={crearYRecibir} disabled={!nuevoProducto.nombre || !nuevoProducto.precioVenta} className="btn-primary flex-1 py-2.5">
                Crear y continuar
              </button>
              <button onClick={() => setCodigoNoEncontrado(null)} className="flex-1 rounded-lg bg-stone-200 py-2.5 font-semibold">
                Cancelar
              </button>
            </div>
          </div>
        )}

        {!productoActivo && !codigoNoEncontrado && (
          <p className="py-8 text-center text-brand-100/60">Escanea el código de barras de lo que va llegando.</p>
        )}

        {historial.length > 0 && (
          <div className="mt-6">
            <p className="mb-2 text-xs font-semibold uppercase text-brand-100/50">Recibido en esta sesión</p>
            {historial.map((h, i) => (
              <p key={i} className="text-sm text-brand-100/80">
                ✓ {h}
              </p>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
