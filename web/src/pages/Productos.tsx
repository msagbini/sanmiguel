import { useEffect, useMemo, useState } from "react";
import { Download } from "lucide-react";
import { api, ApiError } from "../api";
import { useToast } from "../Toast";
import type { Categoria, Producto, TipoMovimiento, Unidad } from "../types";
import { UNIDAD_LABELS } from "../types";
import { RecepcionMercancia } from "../components/RecepcionMercancia";
import { descargarCSV } from "../csv";

const formatoMoneda = new Intl.NumberFormat("es-CO", { style: "currency", currency: "COP", maximumFractionDigits: 0 });

const PRODUCTO_VACIO = {
  codigoBarras: "",
  nombre: "",
  descripcion: "",
  categoriaId: "" as number | "",
  unidad: "UNIDAD" as Unidad,
  precioCosto: "",
  precioVenta: "",
  precioMayorista: "",
  ivaTasa: 19,
  stock: "",
  stockMinimo: "",
};

export function Productos() {
  const { notificar } = useToast();
  const [productos, setProductos] = useState<Producto[]>([]);
  const [categorias, setCategorias] = useState<Categoria[]>([]);
  const [busqueda, setBusqueda] = useState("");
  const [soloStockBajo, setSoloStockBajo] = useState(false);
  const [modalProducto, setModalProducto] = useState<Producto | "nuevo" | null>(null);
  const [form, setForm] = useState(PRODUCTO_VACIO);
  const [productoAjuste, setProductoAjuste] = useState<Producto | null>(null);
  const [nuevaCategoria, setNuevaCategoria] = useState("");
  const [recepcionAbierta, setRecepcionAbierta] = useState(false);

  async function cargar() {
    const [p, c] = await Promise.all([
      api.get<Producto[]>("/productos?soloActivos=false"),
      api.get<Categoria[]>("/categorias"),
    ]);
    setProductos(p);
    setCategorias(c);
  }

  useEffect(() => {
    cargar();
  }, []);

  const filtrados = useMemo(() => {
    return productos.filter((p) => {
      if (soloStockBajo && p.stock > p.stockMinimo) return false;
      const q = busqueda.trim().toLowerCase();
      if (!q) return true;
      return p.nombre.toLowerCase().includes(q) || (p.codigoBarras ?? "").includes(q);
    });
  }, [productos, busqueda, soloStockBajo]);

  function abrirEdicion(p: Producto | "nuevo") {
    if (p === "nuevo") {
      setForm(PRODUCTO_VACIO);
    } else {
      setForm({
        codigoBarras: p.codigoBarras ?? "",
        nombre: p.nombre,
        descripcion: p.descripcion ?? "",
        categoriaId: p.categoriaId ?? "",
        unidad: p.unidad,
        precioCosto: String(p.precioCosto),
        precioVenta: String(p.precioVenta),
        precioMayorista: p.precioMayorista != null ? String(p.precioMayorista) : "",
        ivaTasa: p.ivaTasa,
        stock: String(p.stock),
        stockMinimo: String(p.stockMinimo),
      });
    }
    setModalProducto(p);
  }

  async function guardarProducto() {
    const data = {
      codigoBarras: form.codigoBarras.trim() || null,
      nombre: form.nombre.trim(),
      descripcion: form.descripcion.trim() || null,
      categoriaId: form.categoriaId === "" ? null : Number(form.categoriaId),
      unidad: form.unidad,
      precioCosto: Number(form.precioCosto) || 0,
      precioVenta: Number(form.precioVenta),
      precioMayorista: form.precioMayorista ? Number(form.precioMayorista) : null,
      ivaTasa: Number(form.ivaTasa),
      stock: Number(form.stock) || 0,
      stockMinimo: Number(form.stockMinimo) || 0,
    };
    if (!data.nombre || !data.precioVenta) {
      notificar("Nombre y precio de venta son obligatorios", "error");
      return;
    }
    try {
      if (modalProducto === "nuevo") {
        await api.post("/productos", data);
        notificar("Producto creado", "exito");
      } else if (modalProducto) {
        await api.put(`/productos/${modalProducto.id}`, data);
        notificar("Producto actualizado", "exito");
      }
      setModalProducto(null);
      cargar();
    } catch (err) {
      notificar(err instanceof ApiError ? err.message : "No se pudo guardar el producto", "error");
    }
  }

  async function desactivar(p: Producto) {
    if (!confirm(`¿Quitar "${p.nombre}" del catálogo activo?`)) return;
    await api.delete(`/productos/${p.id}`);
    notificar("Producto desactivado", "exito");
    cargar();
  }

  async function crearCategoria() {
    if (!nuevaCategoria.trim()) return;
    try {
      const cat = await api.post<Categoria>("/categorias", { nombre: nuevaCategoria.trim() });
      setCategorias((prev) => [...prev, cat].sort((a, b) => a.nombre.localeCompare(b.nombre)));
      setForm((f) => ({ ...f, categoriaId: cat.id }));
      setNuevaCategoria("");
    } catch (err) {
      notificar(err instanceof ApiError ? err.message : "No se pudo crear la categoría", "error");
    }
  }

  return (
    <div className="p-4">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-xl font-bold text-stone-800">Productos</h1>
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() =>
              descargarCSV(
                `productos-${new Date().toISOString().slice(0, 10)}.csv`,
                filtrados.map((p) => ({
                  nombre: p.nombre,
                  codigoBarras: p.codigoBarras ?? "",
                  categoria: p.categoria?.nombre ?? "",
                  unidad: UNIDAD_LABELS[p.unidad],
                  precioCosto: p.precioCosto,
                  precioVenta: p.precioVenta,
                  precioMayorista: p.precioMayorista ?? "",
                  iva: p.ivaTasa,
                  stock: p.stock,
                  stockMinimo: p.stockMinimo,
                }))
              )
            }
            className="flex items-center gap-1.5 rounded-lg border border-stone-300 bg-white px-3 py-2 text-sm font-semibold text-stone-600 hover:bg-stone-50"
          >
            <Download size={15} /> CSV
          </button>
          <button
            onClick={() => setRecepcionAbierta(true)}
            className="rounded-lg bg-brand-800 px-4 py-2 font-semibold text-white hover:bg-brand-700"
          >
            📦 Recepción de mercancía
          </button>
          <button onClick={() => abrirEdicion("nuevo")} className="rounded-lg btn-primary px-4 py-2">
            + Nuevo producto
          </button>
        </div>
      </div>

      <div className="mb-4 flex flex-wrap gap-3">
        <input
          value={busqueda}
          onChange={(e) => setBusqueda(e.target.value)}
          placeholder="Buscar por nombre o código de barras..."
          className="min-w-[240px] flex-1 rounded-lg border border-stone-300 px-3 py-2"
        />
        <label className="flex items-center gap-2 rounded-lg border border-stone-300 bg-white px-3 py-2 text-sm">
          <input type="checkbox" checked={soloStockBajo} onChange={(e) => setSoloStockBajo(e.target.checked)} />
          Solo stock bajo
        </label>
      </div>

      <div className="overflow-x-auto rounded-lg border border-stone-200 bg-white">
        <table className="w-full text-sm">
          <thead className="bg-stone-50 text-left text-xs uppercase text-stone-500">
            <tr>
              <th className="px-3 py-2">Producto</th>
              <th className="px-3 py-2">Código</th>
              <th className="px-3 py-2">Categoría</th>
              <th className="px-3 py-2">Costo</th>
              <th className="px-3 py-2">Venta</th>
              <th className="px-3 py-2">IVA</th>
              <th className="px-3 py-2">Stock</th>
              <th className="px-3 py-2">Acciones</th>
            </tr>
          </thead>
          <tbody>
            {filtrados.map((p) => (
              <tr key={p.id} className={`border-t border-stone-100 ${!p.activo ? "opacity-40" : ""}`}>
                <td className="px-3 py-2 font-medium">{p.nombre}</td>
                <td className="px-3 py-2 text-stone-500">{p.codigoBarras ?? "-"}</td>
                <td className="px-3 py-2 text-stone-500">{p.categoria?.nombre ?? "-"}</td>
                <td className="px-3 py-2">{formatoMoneda.format(p.precioCosto)}</td>
                <td className="px-3 py-2">
                  <p className="font-semibold">{formatoMoneda.format(p.precioVenta)}</p>
                  {p.precioMayorista != null && (
                    <p className="text-xs text-blue-700">May: {formatoMoneda.format(p.precioMayorista)}</p>
                  )}
                </td>
                <td className="px-3 py-2">{p.ivaTasa}%</td>
                <td className={`px-3 py-2 font-semibold ${p.stock <= p.stockMinimo ? "text-red-600" : ""}`}>
                  {p.stock} {UNIDAD_LABELS[p.unidad]}
                </td>
                <td className="px-3 py-2">
                  <div className="flex gap-2 whitespace-nowrap">
                    <button onClick={() => abrirEdicion(p)} className="text-xs font-semibold text-brand-700 underline">
                      Editar
                    </button>
                    <button
                      onClick={() => setProductoAjuste(p)}
                      className="text-xs font-semibold text-blue-800 underline"
                    >
                      Ajustar stock
                    </button>
                    {p.activo && (
                      <button onClick={() => desactivar(p)} className="text-xs font-semibold text-red-700 underline">
                        Desactivar
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
            {filtrados.length === 0 && (
              <tr>
                <td colSpan={8} className="px-3 py-8 text-center text-stone-400">
                  Sin resultados
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {modalProducto && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/40 p-4">
          <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-xl bg-white p-6">
            <h2 className="mb-4 text-lg font-bold">
              {modalProducto === "nuevo" ? "Nuevo producto" : "Editar producto"}
            </h2>
            <div className="grid grid-cols-2 gap-3">
              <label className="col-span-2 text-sm">
                Nombre *
                <input
                  value={form.nombre}
                  onChange={(e) => setForm((f) => ({ ...f, nombre: e.target.value }))}
                  className="mt-1 w-full rounded-lg border border-stone-300 px-3 py-2"
                />
              </label>
              <label className="col-span-2 text-sm">
                Código de barras
                <input
                  autoFocus={modalProducto === "nuevo"}
                  value={form.codigoBarras}
                  onChange={(e) => setForm((f) => ({ ...f, codigoBarras: e.target.value }))}
                  placeholder="Escanéalo con la pistola aquí"
                  className="mt-1 w-full rounded-lg border border-stone-300 px-3 py-2"
                />
              </label>
              <label className="col-span-2 text-sm">
                Categoría
                <div className="mt-1 flex gap-2">
                  <select
                    value={form.categoriaId}
                    onChange={(e) => setForm((f) => ({ ...f, categoriaId: e.target.value ? Number(e.target.value) : "" }))}
                    className="w-full rounded-lg border border-stone-300 px-3 py-2"
                  >
                    <option value="">Sin categoría</option>
                    {categorias.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.nombre}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="mt-1 flex gap-2">
                  <input
                    value={nuevaCategoria}
                    onChange={(e) => setNuevaCategoria(e.target.value)}
                    placeholder="Crear categoría nueva..."
                    className="w-full rounded-lg border border-stone-300 px-2 py-1 text-xs"
                  />
                  <button onClick={crearCategoria} type="button" className="whitespace-nowrap text-xs font-semibold text-brand-700 underline">
                    + Crear
                  </button>
                </div>
              </label>
              <label className="text-sm">
                Unidad de venta
                <select
                  value={form.unidad}
                  onChange={(e) => setForm((f) => ({ ...f, unidad: e.target.value as Unidad }))}
                  className="mt-1 w-full rounded-lg border border-stone-300 px-3 py-2"
                >
                  {Object.entries(UNIDAD_LABELS).map(([valor, etiqueta]) => (
                    <option key={valor} value={valor}>
                      {etiqueta}
                    </option>
                  ))}
                </select>
              </label>
              <label className="text-sm">
                IVA
                <select
                  value={form.ivaTasa}
                  onChange={(e) => setForm((f) => ({ ...f, ivaTasa: Number(e.target.value) }))}
                  className="mt-1 w-full rounded-lg border border-stone-300 px-3 py-2"
                >
                  <option value={0}>0% (excluido/exento)</option>
                  <option value={5}>5%</option>
                  <option value={19}>19%</option>
                </select>
              </label>
              <label className="text-sm">
                Precio de costo
                <input
                  type="number"
                  value={form.precioCosto}
                  onChange={(e) => setForm((f) => ({ ...f, precioCosto: e.target.value }))}
                  className="mt-1 w-full rounded-lg border border-stone-300 px-3 py-2"
                />
              </label>
              <label className="text-sm">
                Precio de venta al detal * (IVA incluido)
                <input
                  type="number"
                  value={form.precioVenta}
                  onChange={(e) => setForm((f) => ({ ...f, precioVenta: e.target.value }))}
                  className="mt-1 w-full rounded-lg border border-stone-300 px-3 py-2"
                />
              </label>
              <label className="text-sm">
                Precio mayorista (opcional, para tenderos)
                <input
                  type="number"
                  value={form.precioMayorista}
                  onChange={(e) => setForm((f) => ({ ...f, precioMayorista: e.target.value }))}
                  placeholder="Igual al de detal si se deja vacío"
                  className="mt-1 w-full rounded-lg border border-stone-300 px-3 py-2"
                />
              </label>
              {modalProducto === "nuevo" && (
                <label className="text-sm">
                  Stock inicial
                  <input
                    type="number"
                    value={form.stock}
                    onChange={(e) => setForm((f) => ({ ...f, stock: e.target.value }))}
                    className="mt-1 w-full rounded-lg border border-stone-300 px-3 py-2"
                  />
                </label>
              )}
              <label className="text-sm">
                Alerta de stock mínimo
                <input
                  type="number"
                  value={form.stockMinimo}
                  onChange={(e) => setForm((f) => ({ ...f, stockMinimo: e.target.value }))}
                  className="mt-1 w-full rounded-lg border border-stone-300 px-3 py-2"
                />
              </label>
            </div>
            <div className="mt-5 flex gap-2">
              <button onClick={guardarProducto} className="flex-1 rounded-lg btn-primary py-2.5">
                Guardar
              </button>
              <button onClick={() => setModalProducto(null)} className="flex-1 rounded-lg bg-stone-200 py-2.5 font-semibold">
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}

      {productoAjuste && (
        <ModalAjusteStock
          producto={productoAjuste}
          onClose={() => setProductoAjuste(null)}
          onGuardado={() => {
            setProductoAjuste(null);
            cargar();
          }}
        />
      )}

      {recepcionAbierta && (
        <RecepcionMercancia categorias={categorias} onCerrar={() => setRecepcionAbierta(false)} onCambios={cargar} />
      )}
    </div>
  );
}

function ModalAjusteStock({
  producto,
  onClose,
  onGuardado,
}: {
  producto: Producto;
  onClose: () => void;
  onGuardado: () => void;
}) {
  const { notificar } = useToast();
  const [tipo, setTipo] = useState<TipoMovimiento>("ENTRADA");
  const [cantidad, setCantidad] = useState("");
  const [costoUnitario, setCostoUnitario] = useState(String(producto.precioCosto));
  const [fechaVencimiento, setFechaVencimiento] = useState("");
  const [motivo, setMotivo] = useState("");

  async function guardar() {
    const cant = Number(cantidad);
    if (!cant || cant <= 0) {
      notificar("Ingresa una cantidad válida", "error");
      return;
    }
    try {
      await api.post(`/productos/${producto.id}/ajuste`, {
        tipo,
        cantidad: cant,
        costoUnitario: tipo === "ENTRADA" ? Number(costoUnitario) || undefined : undefined,
        fechaVencimiento: tipo === "ENTRADA" && fechaVencimiento ? fechaVencimiento : undefined,
        motivo: motivo || undefined,
      });
      notificar("Inventario actualizado", "exito");
      onGuardado();
    } catch (err) {
      notificar(err instanceof ApiError ? err.message : "No se pudo ajustar el inventario", "error");
    }
  }

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-sm rounded-xl bg-white p-6">
        <h2 className="mb-1 text-lg font-bold">Ajustar inventario</h2>
        <p className="mb-4 text-sm text-stone-500">
          {producto.nombre} · Stock actual: {producto.stock} {UNIDAD_LABELS[producto.unidad]}
        </p>
        <div className="flex flex-col gap-3">
          <label className="text-sm">
            Tipo de movimiento
            <select
              value={tipo}
              onChange={(e) => setTipo(e.target.value as TipoMovimiento)}
              className="mt-1 w-full rounded-lg border border-stone-300 px-3 py-2"
            >
              <option value="ENTRADA">Entrada (compra a proveedor)</option>
              <option value="SALIDA">Salida (merma / daño / vencido)</option>
              <option value="AJUSTE">Ajuste (fijar cantidad tras conteo físico)</option>
              <option value="DEVOLUCION">Devolución de mercancía</option>
            </select>
          </label>
          <label className="text-sm">
            {tipo === "AJUSTE" ? "Cantidad real contada" : "Cantidad"}
            <input
              type="number"
              value={cantidad}
              onChange={(e) => setCantidad(e.target.value)}
              className="mt-1 w-full rounded-lg border border-stone-300 px-3 py-2"
            />
          </label>
          {tipo === "ENTRADA" && (
            <>
              <label className="text-sm">
                Costo unitario de compra
                <input
                  type="number"
                  value={costoUnitario}
                  onChange={(e) => setCostoUnitario(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-stone-300 px-3 py-2"
                />
              </label>
              <label className="text-sm">
                Fecha de vencimiento (opcional, para productos perecederos)
                <input
                  type="date"
                  value={fechaVencimiento}
                  onChange={(e) => setFechaVencimiento(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-stone-300 px-3 py-2"
                />
              </label>
            </>
          )}
          <label className="text-sm">
            Motivo (opcional)
            <input
              value={motivo}
              onChange={(e) => setMotivo(e.target.value)}
              className="mt-1 w-full rounded-lg border border-stone-300 px-3 py-2"
            />
          </label>
        </div>
        <div className="mt-5 flex gap-2">
          <button onClick={guardar} className="flex-1 rounded-lg btn-primary py-2.5">
            Guardar
          </button>
          <button onClick={onClose} className="flex-1 rounded-lg bg-stone-200 py-2.5 font-semibold">
            Cancelar
          </button>
        </div>
      </div>
    </div>
  );
}
