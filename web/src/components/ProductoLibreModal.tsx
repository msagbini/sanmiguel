import { useState } from "react";

export interface ProductoLibreDatos {
  nombre: string;
  cantidad: number;
  precio: number;
  ivaTasa: number;
  costo: number;
}

export function ProductoLibreModal({
  onGuardar,
  onCerrar,
}: {
  onGuardar: (datos: ProductoLibreDatos) => void;
  onCerrar: () => void;
}) {
  const [nombre, setNombre] = useState("");
  const [cantidad, setCantidad] = useState("1");
  const [precio, setPrecio] = useState("");
  const [ivaTasa, setIvaTasa] = useState(19);
  const [costo, setCosto] = useState("");

  function guardar() {
    if (!nombre.trim() || !precio) return;
    onGuardar({
      nombre: nombre.trim(),
      cantidad: Number(cantidad) || 1,
      precio: Number(precio),
      ivaTasa,
      costo: Number(costo) || 0,
    });
  }

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-sm rounded-xl bg-white p-6">
        <h2 className="mb-1 text-lg font-bold">Producto libre</h2>
        <p className="mb-4 text-sm text-stone-500">Para algo que no está en el catálogo. No descuenta inventario.</p>
        <div className="flex flex-col gap-3">
          <label className="text-sm">
            Nombre / descripción *
            <input
              autoFocus
              value={nombre}
              onChange={(e) => setNombre(e.target.value)}
              className="mt-1 w-full rounded-lg border border-stone-300 px-3 py-2"
            />
          </label>
          <div className="grid grid-cols-2 gap-3">
            <label className="text-sm">
              Cantidad
              <input
                type="number"
                value={cantidad}
                onChange={(e) => setCantidad(e.target.value)}
                className="mt-1 w-full rounded-lg border border-stone-300 px-3 py-2"
              />
            </label>
            <label className="text-sm">
              Precio de venta *
              <input
                type="number"
                value={precio}
                onChange={(e) => setPrecio(e.target.value)}
                className="mt-1 w-full rounded-lg border border-stone-300 px-3 py-2"
              />
            </label>
            <label className="text-sm">
              IVA
              <select value={ivaTasa} onChange={(e) => setIvaTasa(Number(e.target.value))} className="mt-1 w-full rounded-lg border border-stone-300 px-3 py-2">
                <option value={0}>0%</option>
                <option value={5}>5%</option>
                <option value={19}>19%</option>
              </select>
            </label>
            <label className="text-sm">
              Costo (opcional)
              <input
                type="number"
                value={costo}
                onChange={(e) => setCosto(e.target.value)}
                placeholder="Para calcular ganancia"
                className="mt-1 w-full rounded-lg border border-stone-300 px-3 py-2"
              />
            </label>
          </div>
        </div>
        <div className="mt-5 flex gap-2">
          <button
            onClick={guardar}
            disabled={!nombre.trim() || !precio}
            className="flex-1 rounded-lg btn-primary py-2.5 disabled:opacity-50"
          >
            Agregar al carrito
          </button>
          <button onClick={onCerrar} className="flex-1 rounded-lg bg-stone-200 py-2.5 font-semibold">
            Cancelar
          </button>
        </div>
      </div>
    </div>
  );
}
