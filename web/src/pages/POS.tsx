import { useEffect, useMemo, useState } from "react";
import { api, ApiError } from "../api";
import type { Categoria, Cliente, Configuracion, MetodoPago, Producto, Venta } from "../types";
import { useBarcodeScanner } from "../hooks/useBarcodeScanner";
import { useToast } from "../Toast";
import { ClienteSelector } from "../components/ClienteSelector";
import { Recibo } from "../components/Recibo";

const formatoMoneda = new Intl.NumberFormat("es-CO", {
  style: "currency",
  currency: "COP",
  maximumFractionDigits: 0,
});

interface ItemCarrito {
  producto: Producto;
  cantidad: number;
  descuento: number;
}

export function POS() {
  const { notificar } = useToast();
  const [productos, setProductos] = useState<Producto[]>([]);
  const [categorias, setCategorias] = useState<Categoria[]>([]);
  const [categoriaId, setCategoriaId] = useState<number | null>(null);
  const [config, setConfig] = useState<Configuracion | null>(null);

  const [carrito, setCarrito] = useState<ItemCarrito[]>([]);
  const [cliente, setCliente] = useState<Cliente | null>(null);
  const [metodoPago, setMetodoPago] = useState<MetodoPago>("EFECTIVO");
  const [efectivoRecibido, setEfectivoRecibido] = useState<string>("");
  const [procesando, setProcesando] = useState(false);
  const [ventaCompletada, setVentaCompletada] = useState<Venta | null>(null);

  useEffect(() => {
    api.get<Producto[]>("/productos").then(setProductos);
    api.get<Categoria[]>("/categorias").then(setCategorias);
    api.get<Configuracion>("/configuracion").then(setConfig);
  }, []);

  function agregarAlCarrito(producto: Producto) {
    if (!producto.activo) {
      notificar(`${producto.nombre} no está disponible`, "error");
      return;
    }
    if (producto.stock <= 0) {
      notificar(`${producto.nombre} no tiene stock disponible`, "error");
      return;
    }
    setCarrito((prev) => {
      const existente = prev.find((i) => i.producto.id === producto.id);
      if (existente) {
        if (existente.cantidad + 1 > producto.stock) {
          notificar(`Solo quedan ${producto.stock} unidades de ${producto.nombre}`, "error");
          return prev;
        }
        return prev.map((i) => (i.producto.id === producto.id ? { ...i, cantidad: i.cantidad + 1 } : i));
      }
      return [...prev, { producto, cantidad: 1, descuento: 0 }];
    });
  }

  async function manejarEscaneo(codigo: string) {
    try {
      const producto = await api.get<Producto>(`/productos/codigo/${encodeURIComponent(codigo)}`);
      agregarAlCarrito(producto);
      return;
    } catch {
      // no es un código de barras exacto, intentamos por nombre
    }
    const coincidencias = productos.filter(
      (p) => p.nombre.toLowerCase().includes(codigo.toLowerCase()) || p.codigoBarras === codigo
    );
    if (coincidencias.length === 1) {
      agregarAlCarrito(coincidencias[0]);
    } else if (coincidencias.length > 1) {
      notificar("Hay varios productos que coinciden, selecciónalo de la lista", "info");
    } else {
      notificar(`No se encontró ningún producto para "${codigo}"`, "error");
    }
  }

  const { inputProps, enfocar } = useBarcodeScanner(manejarEscaneo);

  const productosFiltrados = useMemo(() => {
    const q = inputProps.value.trim().toLowerCase();
    return productos.filter((p) => {
      if (categoriaId && p.categoriaId !== categoriaId) return false;
      if (!q) return true;
      return p.nombre.toLowerCase().includes(q) || (p.codigoBarras ?? "").includes(q);
    });
  }, [productos, categoriaId, inputProps.value]);

  function cambiarCantidad(productoId: number, delta: number) {
    setCarrito((prev) =>
      prev
        .map((item) => {
          if (item.producto.id !== productoId) return item;
          const nueva = item.cantidad + delta;
          if (nueva > item.producto.stock) {
            notificar(`Solo quedan ${item.producto.stock} unidades de ${item.producto.nombre}`, "error");
            return item;
          }
          return { ...item, cantidad: nueva };
        })
        .filter((item) => item.cantidad > 0)
    );
  }

  function quitarItem(productoId: number) {
    setCarrito((prev) => prev.filter((item) => item.producto.id !== productoId));
  }

  const totales = useMemo(() => {
    let subtotal = 0;
    let ivaTotal = 0;
    let total = 0;
    for (const item of carrito) {
      const totalConIva = item.producto.precioVenta * item.cantidad - item.descuento;
      const base = totalConIva / (1 + item.producto.ivaTasa / 100);
      subtotal += base;
      ivaTotal += totalConIva - base;
      total += totalConIva;
    }
    return { subtotal, ivaTotal, total };
  }, [carrito]);

  const efectivoNum = Number(efectivoRecibido) || 0;
  const cambio = efectivoNum - totales.total;

  function nuevaVenta() {
    setCarrito([]);
    setCliente(null);
    setEfectivoRecibido("");
    setMetodoPago("EFECTIVO");
    setVentaCompletada(null);
    setTimeout(enfocar, 0);
  }

  async function cobrar() {
    if (carrito.length === 0) return;
    if (metodoPago === "EFECTIVO" && efectivoNum < totales.total) {
      notificar("El efectivo recibido es menor que el total", "error");
      return;
    }
    setProcesando(true);
    try {
      const resultado = await api.post<{ venta: Venta; facturacionElectronicaError: string | null }>(
        "/ventas",
        {
          clienteId: cliente?.id ?? null,
          items: carrito.map((i) => ({
            productoId: i.producto.id,
            cantidad: i.cantidad,
            descuento: i.descuento,
          })),
          metodoPago,
          efectivoRecibido: metodoPago === "EFECTIVO" ? efectivoNum : null,
        }
      );
      setVentaCompletada(resultado.venta);
      notificar("Venta registrada", "exito");
      if (resultado.facturacionElectronicaError) {
        notificar(
          `Se guardó como documento POS: no se pudo facturar electrónicamente (${resultado.facturacionElectronicaError})`,
          "info"
        );
      }
      api.get<Producto[]>("/productos").then(setProductos);
    } catch (err) {
      notificar(err instanceof ApiError ? err.message : "No se pudo registrar la venta", "error");
    } finally {
      setProcesando(false);
    }
  }

  if (ventaCompletada && config) {
    return (
      <div className="mx-auto max-w-md p-4">
        <div className="no-imprimir mb-4 flex gap-2">
          <button
            onClick={() => window.print()}
            className="flex-1 rounded-lg bg-orange-800 py-2.5 font-semibold text-white hover:bg-orange-900"
          >
            🖨️ Imprimir recibo
          </button>
          <button
            onClick={nuevaVenta}
            className="flex-1 rounded-lg bg-stone-700 py-2.5 font-semibold text-white hover:bg-stone-800"
          >
            Nueva venta
          </button>
        </div>
        <div className="rounded-lg border border-stone-300 bg-stone-50 py-4">
          <Recibo venta={ventaCompletada} config={config} />
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col lg:grid lg:h-full lg:grid-cols-[1fr_380px]">
      <div className="flex flex-col p-4 lg:overflow-hidden">
        <input
          {...inputProps}
          placeholder="Escanea el código de barras o escribe para buscar..."
          className="mb-3 w-full rounded-lg border-2 border-orange-700 px-4 py-3 text-lg focus:outline-none focus:ring-2 focus:ring-orange-500"
        />

        <div className="mb-3 flex flex-wrap gap-2">
          <button
            onClick={() => setCategoriaId(null)}
            className={`rounded-full px-3 py-1 text-sm font-medium ${
              categoriaId === null ? "bg-orange-800 text-white" : "bg-white text-stone-600 border border-stone-300"
            }`}
          >
            Todas
          </button>
          {categorias.map((c) => (
            <button
              key={c.id}
              onClick={() => setCategoriaId(c.id)}
              className={`rounded-full px-3 py-1 text-sm font-medium ${
                categoriaId === c.id ? "bg-orange-800 text-white" : "bg-white text-stone-600 border border-stone-300"
              }`}
            >
              {c.nombre}
            </button>
          ))}
        </div>

        <div className="grid auto-rows-min grid-cols-2 gap-2 sm:grid-cols-3 xl:grid-cols-4 lg:flex-1 lg:overflow-y-auto">
          {productosFiltrados.map((p) => (
            <button
              key={p.id}
              onClick={() => agregarAlCarrito(p)}
              disabled={p.stock <= 0}
              className="flex flex-col items-start rounded-lg border border-stone-200 bg-white p-3 text-left shadow-sm hover:border-orange-500 hover:shadow disabled:opacity-40"
            >
              <span className="line-clamp-2 text-sm font-medium text-stone-800">{p.nombre}</span>
              <span className="mt-1 text-base font-bold text-orange-800">
                {formatoMoneda.format(p.precioVenta)}
              </span>
              <span className={`text-xs ${p.stock <= p.stockMinimo ? "text-red-600" : "text-stone-400"}`}>
                Stock: {p.stock}
              </span>
            </button>
          ))}
          {productosFiltrados.length === 0 && (
            <p className="col-span-full py-8 text-center text-stone-400">Sin resultados</p>
          )}
        </div>
      </div>

      <div className="flex flex-col border-t border-stone-200 bg-white p-4 lg:border-l lg:border-t-0">
        <h2 className="mb-2 text-lg font-bold text-stone-800">Carrito</h2>
        <div className="mb-3">
          <ClienteSelector cliente={cliente} onChange={setCliente} />
        </div>

        <div className="flex-1 overflow-y-auto">
          {carrito.length === 0 && <p className="py-8 text-center text-sm text-stone-400">Aún no hay productos</p>}
          {carrito.map((item) => (
            <div key={item.producto.id} className="mb-2 flex items-center gap-2 border-b border-stone-100 pb-2">
              <div className="flex-1">
                <p className="text-sm font-medium text-stone-800">{item.producto.nombre}</p>
                <p className="text-xs text-stone-400">{formatoMoneda.format(item.producto.precioVenta)} c/u</p>
              </div>
              <button
                onClick={() => cambiarCantidad(item.producto.id, -1)}
                className="h-7 w-7 rounded-full bg-stone-200 font-bold text-stone-700 hover:bg-stone-300"
              >
                −
              </button>
              <span className="w-6 text-center text-sm font-semibold">{item.cantidad}</span>
              <button
                onClick={() => cambiarCantidad(item.producto.id, 1)}
                className="h-7 w-7 rounded-full bg-stone-200 font-bold text-stone-700 hover:bg-stone-300"
              >
                +
              </button>
              <span className="w-20 text-right text-sm font-semibold">
                {formatoMoneda.format(item.producto.precioVenta * item.cantidad - item.descuento)}
              </span>
              <button onClick={() => quitarItem(item.producto.id)} className="text-stone-400 hover:text-red-600">
                ✕
              </button>
            </div>
          ))}
        </div>

        <div className="mt-2 border-t border-stone-200 pt-2 text-sm">
          <div className="flex justify-between text-stone-500">
            <span>Subtotal</span>
            <span>{formatoMoneda.format(totales.subtotal)}</span>
          </div>
          <div className="flex justify-between text-stone-500">
            <span>IVA</span>
            <span>{formatoMoneda.format(totales.ivaTotal)}</span>
          </div>
          <div className="flex justify-between text-xl font-bold text-stone-900">
            <span>Total</span>
            <span>{formatoMoneda.format(totales.total)}</span>
          </div>
        </div>

        <div className="mt-3">
          <label className="mb-1 block text-xs font-medium text-stone-500">Forma de pago</label>
          <select
            value={metodoPago}
            onChange={(e) => setMetodoPago(e.target.value as MetodoPago)}
            className="w-full rounded-lg border border-stone-300 px-3 py-2"
          >
            <option value="EFECTIVO">Efectivo</option>
            <option value="TARJETA">Tarjeta</option>
            <option value="TRANSFERENCIA">Transferencia / Nequi / Daviplata</option>
            <option value="MIXTO">Mixto</option>
          </select>
        </div>

        {metodoPago === "EFECTIVO" && (
          <div className="mt-2">
            <label className="mb-1 block text-xs font-medium text-stone-500">Efectivo recibido</label>
            <input
              type="number"
              inputMode="decimal"
              value={efectivoRecibido}
              onChange={(e) => setEfectivoRecibido(e.target.value)}
              className="w-full rounded-lg border border-stone-300 px-3 py-2"
              placeholder="0"
            />
            {efectivoRecibido && (
              <p className={`mt-1 text-sm font-semibold ${cambio < 0 ? "text-red-600" : "text-green-700"}`}>
                Cambio: {formatoMoneda.format(Math.max(cambio, 0))}
              </p>
            )}
          </div>
        )}

        <button
          onClick={cobrar}
          disabled={carrito.length === 0 || procesando}
          className="mt-4 rounded-lg bg-green-700 py-3 text-lg font-bold text-white hover:bg-green-800 disabled:opacity-50"
        >
          {procesando ? "Procesando..." : `Cobrar ${formatoMoneda.format(totales.total)}`}
        </button>
      </div>
    </div>
  );
}
