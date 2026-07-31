import { useEffect, useMemo, useState } from "react";
import { api, ApiError } from "../api";
import { useAuth } from "../AuthContext";
import type { Categoria, Cliente, Configuracion, MetodoPago, Producto, TopProducto, Venta } from "../types";
import { useBarcodeScanner } from "../hooks/useBarcodeScanner";
import { useToast } from "../Toast";
import { ClienteSelector } from "../components/ClienteSelector";
import { Recibo } from "../components/Recibo";
import { ProductoLibreModal, type ProductoLibreDatos } from "../components/ProductoLibreModal";
import { PantallaCobro } from "../components/PantallaCobro";
import { beepExito, beepError } from "../sonido";

const formatoMoneda = new Intl.NumberFormat("es-CO", {
  style: "currency",
  currency: "COP",
  maximumFractionDigits: 0,
});

interface ItemCarrito {
  key: string;
  productoId: number | null;
  producto: Producto | null;
  nombre: string;
  cantidad: number;
  precioUnitario: number;
  precioManual: boolean;
  ivaTasa: number;
  costoUnitario: number;
  stockDisponible: number | null;
}

function precioSugerido(producto: Producto, cliente: Cliente | null): number {
  if (cliente?.tipoCliente === "MAYORISTA" && producto.precioMayorista != null) return producto.precioMayorista;
  return producto.precioVenta;
}

const DESCUENTOS_RAPIDOS = [1, 2, 3, 5, 10];

export function POS() {
  const { notificar } = useToast();
  const { usuario } = useAuth();
  const [productos, setProductos] = useState<Producto[]>([]);
  const [categorias, setCategorias] = useState<Categoria[]>([]);
  const [categoriaId, setCategoriaId] = useState<number | null>(null);
  const [config, setConfig] = useState<Configuracion | null>(null);

  const [carrito, setCarrito] = useState<ItemCarrito[]>([]);
  const [cliente, setCliente] = useState<Cliente | null>(null);
  const [metodoPago, setMetodoPago] = useState<MetodoPago>("EFECTIVO");
  const [efectivoRecibido, setEfectivoRecibido] = useState<string>("");
  const [descuentoGlobalPct, setDescuentoGlobalPct] = useState(0);
  const [descuentoCustom, setDescuentoCustom] = useState("");
  const [modalLibreAbierto, setModalLibreAbierto] = useState(false);
  const [pantallaCobroAbierta, setPantallaCobroAbierta] = useState(false);
  const [procesando, setProcesando] = useState(false);
  const [ventaCompletada, setVentaCompletada] = useState<Venta | null>(null);
  const [masVendidos, setMasVendidos] = useState<Map<number, number>>(new Map());

  useEffect(() => {
    api.get<Producto[]>("/productos").then(setProductos);
    api.get<Categoria[]>("/categorias").then(setCategorias);
    api.get<Configuracion>("/configuracion").then(setConfig);

    // Catálogo ordenado por lo más vendido en los últimos 30 días, para que
    // lo que el negocio más rota quede primero sin tener que buscarlo.
    const hace30Dias = new Date();
    hace30Dias.setDate(hace30Dias.getDate() - 30);
    api
      .get<TopProducto[]>(`/reportes/top-productos?desde=${hace30Dias.toISOString()}&limit=500`)
      .then((top) => setMasVendidos(new Map(top.map((t) => [t.productoId, t.cantidad]))));
  }, []);

  // Si se elige (o cambia) un cliente mayorista, los productos ya en el
  // carrito que no hayan sido editados a mano recalculan su precio.
  useEffect(() => {
    setCarrito((prev) =>
      prev.map((item) => {
        if (item.precioManual || !item.producto) return item;
        return { ...item, precioUnitario: precioSugerido(item.producto, cliente) };
      })
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cliente?.id, cliente?.tipoCliente]);

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
      const key = `p-${producto.id}`;
      const existente = prev.find((i) => i.key === key);
      if (existente) {
        if (existente.cantidad + 1 > producto.stock) {
          notificar(`Solo quedan ${producto.stock} unidades de ${producto.nombre}`, "error");
          return prev;
        }
        return prev.map((i) => (i.key === key ? { ...i, cantidad: i.cantidad + 1 } : i));
      }
      return [
        ...prev,
        {
          key,
          productoId: producto.id,
          producto,
          nombre: producto.nombre,
          cantidad: 1,
          precioUnitario: precioSugerido(producto, cliente),
          precioManual: false,
          ivaTasa: producto.ivaTasa,
          costoUnitario: producto.precioCosto,
          stockDisponible: producto.stock,
        },
      ];
    });
  }

  function agregarProductoLibre(datos: ProductoLibreDatos) {
    setCarrito((prev) => [
      ...prev,
      {
        key: `libre-${Date.now()}-${Math.random()}`,
        productoId: null,
        producto: null,
        nombre: datos.nombre,
        cantidad: datos.cantidad,
        precioUnitario: datos.precio,
        precioManual: true,
        ivaTasa: datos.ivaTasa,
        costoUnitario: datos.costo,
        stockDisponible: null,
      },
    ]);
    setModalLibreAbierto(false);
  }

  async function manejarEscaneo(codigo: string) {
    try {
      const producto = await api.get<Producto>(`/productos/codigo/${encodeURIComponent(codigo)}`);
      beepExito();
      agregarAlCarrito(producto);
      return;
    } catch {
      // no es un código de barras exacto, intentamos por nombre
    }
    const coincidencias = productos.filter(
      (p) => p.nombre.toLowerCase().includes(codigo.toLowerCase()) || p.codigoBarras === codigo
    );
    if (coincidencias.length === 1) {
      beepExito();
      agregarAlCarrito(coincidencias[0]);
    } else if (coincidencias.length > 1) {
      notificar("Hay varios productos que coinciden, selecciónalo de la lista", "info");
    } else {
      beepError();
      notificar(`No se encontró ningún producto para "${codigo}"`, "error");
    }
  }

  const { inputProps, enfocar } = useBarcodeScanner(manejarEscaneo);

  const productosFiltrados = useMemo(() => {
    const q = inputProps.value.trim().toLowerCase();
    return productos
      .filter((p) => {
        if (categoriaId && p.categoriaId !== categoriaId) return false;
        if (!q) return true;
        return p.nombre.toLowerCase().includes(q) || (p.codigoBarras ?? "").includes(q);
      })
      .sort((a, b) => (masVendidos.get(b.id) ?? 0) - (masVendidos.get(a.id) ?? 0) || a.nombre.localeCompare(b.nombre));
  }, [productos, categoriaId, inputProps.value, masVendidos]);

  function cambiarCantidad(key: string, delta: number) {
    setCarrito((prev) =>
      prev
        .map((item) => {
          if (item.key !== key) return item;
          const nueva = item.cantidad + delta;
          if (item.stockDisponible != null && nueva > item.stockDisponible) {
            notificar(`Solo quedan ${item.stockDisponible} unidades de ${item.nombre}`, "error");
            return item;
          }
          return { ...item, cantidad: nueva };
        })
        .filter((item) => item.cantidad > 0)
    );
  }

  function actualizarPrecio(key: string, nuevoPrecio: number) {
    setCarrito((prev) => prev.map((item) => (item.key === key ? { ...item, precioUnitario: nuevoPrecio, precioManual: true } : item)));
  }

  function quitarItem(key: string) {
    setCarrito((prev) => prev.filter((item) => item.key !== key));
  }

  const capDescuentoCajero = config?.descuentoMaximoCajeroPct ?? 5;
  const esAdmin = usuario?.rol === "ADMIN";
  const descuentoSuperaTope = !esAdmin && descuentoGlobalPct > capDescuentoCajero;

  const itemsCalculados = useMemo(() => {
    return carrito.map((item) => {
      const bruto = item.precioUnitario * item.cantidad;
      const descuentoLinea = bruto * (descuentoGlobalPct / 100);
      const totalConIva = bruto - descuentoLinea;
      const base = totalConIva / (1 + item.ivaTasa / 100);
      const iva = totalConIva - base;
      const costoLinea = item.costoUnitario * item.cantidad;
      const ganancia = base - costoLinea;
      return { ...item, bruto, descuentoLinea, totalConIva, base, iva, ganancia };
    });
  }, [carrito, descuentoGlobalPct]);

  const totales = useMemo(() => {
    let subtotal = 0;
    let ivaTotal = 0;
    let total = 0;
    let descuento = 0;
    let ganancia = 0;
    for (const item of itemsCalculados) {
      subtotal += item.base;
      ivaTotal += item.iva;
      total += item.totalConIva;
      descuento += item.descuentoLinea;
      ganancia += item.ganancia;
    }
    const margenPct = total > 0 ? (ganancia / total) * 100 : 0;
    return { subtotal, ivaTotal, total, descuento, ganancia, margenPct };
  }, [itemsCalculados]);

  const efectivoNum = Number(efectivoRecibido) || 0;
  const cambio = efectivoNum - totales.total;

  const margenAlerta = config?.margenAlertaPct ?? 8;
  const margenBajo = carrito.length > 0 && totales.margenPct < margenAlerta;

  const cupoDisponible = cliente ? cliente.limiteCredito - cliente.saldoPendiente : 0;
  const fiadoInvalido =
    metodoPago === "CREDITO" &&
    (!cliente || cliente.esConsumidorFinal || cliente.limiteCredito <= 0 || totales.total > cupoDisponible);

  function nuevaVenta() {
    setCarrito([]);
    setCliente(null);
    setEfectivoRecibido("");
    setMetodoPago("EFECTIVO");
    setDescuentoGlobalPct(0);
    setDescuentoCustom("");
    setVentaCompletada(null);
    setTimeout(enfocar, 0);
  }

  async function cobrar() {
    if (carrito.length === 0) return;
    if (metodoPago === "EFECTIVO" && efectivoNum < totales.total) {
      notificar("El efectivo recibido es menor que el total", "error");
      return;
    }
    if (fiadoInvalido) {
      notificar("Este cliente no tiene cupo de fiado suficiente para esta venta", "error");
      return;
    }
    setProcesando(true);
    try {
      const resultado = await api.post<{ venta: Venta; facturacionElectronicaError: string | null }>(
        "/ventas",
        {
          clienteId: cliente?.id ?? null,
          items: itemsCalculados.map((i) => ({
            productoId: i.productoId,
            nombreProducto: i.producto ? undefined : i.nombre,
            cantidad: i.cantidad,
            precioUnitario: i.precioUnitario,
            ivaTasa: i.producto ? undefined : i.ivaTasa,
            costoUnitarioLibre: i.producto ? undefined : i.costoUnitario,
            descuento: i.descuentoLinea,
          })),
          metodoPago,
          efectivoRecibido: metodoPago === "EFECTIVO" ? efectivoNum : null,
        }
      );
      setVentaCompletada(resultado.venta);
      notificar(metodoPago === "CREDITO" ? "Venta fiada registrada" : "Venta registrada", "exito");
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

  // Con tarjeta, primero se muestra la pantalla de cobro (el monto en grande
  // para digitarlo en el datáfono) y solo se registra la venta cuando el
  // cajero confirma que el cliente ya pagó.
  function alHacerClicCobrar() {
    if (metodoPago === "TARJETA") {
      setPantallaCobroAbierta(true);
    } else {
      cobrar();
    }
  }

  // Atajos de teclado tipo POS de mostrador: F2 vuelve al campo de escaneo,
  // F9 cobra, Escape cierra lo que esté abierto.
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "F2") {
        e.preventDefault();
        enfocar();
      } else if (e.key === "F9") {
        e.preventDefault();
        if (!ventaCompletada) alHacerClicCobrar();
      } else if (e.key === "Escape") {
        if (pantallaCobroAbierta) setPantallaCobroAbierta(false);
        else if (modalLibreAbierto) setModalLibreAbierto(false);
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    metodoPago,
    carrito,
    descuentoGlobalPct,
    cliente,
    efectivoRecibido,
    procesando,
    fiadoInvalido,
    pantallaCobroAbierta,
    modalLibreAbierto,
    ventaCompletada,
  ]);

  if (ventaCompletada && config) {
    return (
      <div className="mx-auto max-w-md p-4">
        <div className="no-imprimir mb-4 flex gap-2">
          <button
            onClick={() => window.print()}
            className="flex-1 rounded-lg btn-primary py-2.5"
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
        <div className="mb-3 flex gap-2">
          <input
            {...inputProps}
            placeholder="Escanea el código de barras o escribe para buscar..."
            className="w-full rounded-lg border-2 border-brand-700 px-4 py-3 text-lg focus:outline-none focus:ring-2 focus:ring-gold-500"
          />
          <button
            onClick={() => setModalLibreAbierto(true)}
            className="shrink-0 whitespace-nowrap rounded-lg border-2 border-stone-300 bg-white px-3 font-semibold text-stone-700 hover:bg-stone-50"
            title="Agregar algo que no está en el catálogo"
          >
            + Libre
          </button>
        </div>

        <div className="mb-3 flex flex-wrap gap-2">
          <button
            onClick={() => setCategoriaId(null)}
            className={`rounded-full px-3 py-1 text-sm font-medium ${
              categoriaId === null ? "bg-brand-800 text-white" : "bg-white text-stone-600 border border-stone-300"
            }`}
          >
            Todas
          </button>
          {categorias.map((c) => (
            <button
              key={c.id}
              onClick={() => setCategoriaId(c.id)}
              className={`rounded-full px-3 py-1 text-sm font-medium ${
                categoriaId === c.id ? "bg-brand-800 text-white" : "bg-white text-stone-600 border border-stone-300"
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
              className="flex flex-col items-start rounded-lg border border-stone-200 bg-white p-3 text-left shadow-sm hover:border-gold-500 hover:shadow disabled:opacity-40"
            >
              <span className="line-clamp-2 text-sm font-medium text-stone-800">{p.nombre}</span>
              <span className="mt-1 text-base font-bold text-gold-700">
                {formatoMoneda.format(cliente?.tipoCliente === "MAYORISTA" ? precioSugerido(p, cliente) : p.precioVenta)}
              </span>
              {cliente?.tipoCliente === "MAYORISTA" && p.precioMayorista != null && (
                <span className="text-xs text-blue-700">Precio mayorista</span>
              )}
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
          {itemsCalculados.map((item) => (
            <div key={item.key} className="mb-2 flex items-center gap-2 border-b border-stone-100 pb-2">
              <div className="flex-1">
                <p className="text-sm font-medium text-stone-800">
                  {item.nombre}
                  {!item.producto && <span className="ml-1 rounded bg-stone-100 px-1 text-[10px] text-stone-500">LIBRE</span>}
                </p>
                <div className="flex items-center gap-1 text-xs text-stone-400">
                  $
                  <input
                    type="number"
                    value={item.precioUnitario}
                    onChange={(e) => actualizarPrecio(item.key, Number(e.target.value) || 0)}
                    className="w-16 rounded border border-stone-200 px-1 py-0.5"
                  />
                  c/u
                  {item.precioManual && item.producto && <span className="text-amber-600">(editado)</span>}
                </div>
              </div>
              <button
                onClick={() => cambiarCantidad(item.key, -1)}
                className="h-7 w-7 rounded-full bg-stone-200 font-bold text-stone-700 hover:bg-stone-300"
              >
                −
              </button>
              <span className="w-6 text-center text-sm font-semibold">{item.cantidad}</span>
              <button
                onClick={() => cambiarCantidad(item.key, 1)}
                className="h-7 w-7 rounded-full bg-stone-200 font-bold text-stone-700 hover:bg-stone-300"
              >
                +
              </button>
              <span className="w-20 text-right text-sm font-semibold">{formatoMoneda.format(item.totalConIva)}</span>
              <button onClick={() => quitarItem(item.key)} className="text-stone-400 hover:text-red-600">
                ✕
              </button>
            </div>
          ))}
        </div>

        <div className="mt-2 flex flex-wrap items-center gap-1.5">
          <span className="text-xs font-medium text-stone-500">Descuento:</span>
          {DESCUENTOS_RAPIDOS.filter((p) => esAdmin || p <= capDescuentoCajero).map((p) => (
            <button
              key={p}
              onClick={() => setDescuentoGlobalPct(descuentoGlobalPct === p ? 0 : p)}
              className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                descuentoGlobalPct === p ? "bg-brand-800 text-white" : "bg-stone-100 text-stone-600 hover:bg-stone-200"
              }`}
            >
              {p}%
            </button>
          ))}
          <input
            type="number"
            placeholder="Otro %"
            value={descuentoCustom}
            onChange={(e) => {
              setDescuentoCustom(e.target.value);
              setDescuentoGlobalPct(Number(e.target.value) || 0);
            }}
            className="w-16 rounded border border-stone-200 px-1.5 py-0.5 text-xs"
          />
        </div>
        {descuentoSuperaTope && (
          <p className="mt-1 text-xs font-semibold text-red-600">
            Supera el {capDescuentoCajero}% que puede autorizar un cajero. Un administrador debe aplicarlo.
          </p>
        )}

        <div className="mt-2 border-t border-stone-200 pt-2 text-sm">
          <div className="flex justify-between text-stone-500">
            <span>Subtotal</span>
            <span>{formatoMoneda.format(totales.subtotal)}</span>
          </div>
          {totales.descuento > 0 && (
            <div className="flex justify-between text-stone-500">
              <span>Descuento</span>
              <span>-{formatoMoneda.format(totales.descuento)}</span>
            </div>
          )}
          <div className="flex justify-between text-stone-500">
            <span>IVA</span>
            <span>{formatoMoneda.format(totales.ivaTotal)}</span>
          </div>
          <div className="flex justify-between text-xl font-bold text-stone-900">
            <span>Total</span>
            <span>{formatoMoneda.format(totales.total)}</span>
          </div>
          {carrito.length > 0 && (
            <div className={`mt-1 flex justify-between rounded px-2 py-1 text-xs font-semibold ${margenBajo ? "bg-red-50 text-red-700" : "bg-green-50 text-green-700"}`}>
              <span>{margenBajo ? "⚠️ Margen bajo" : "Ganancia"}</span>
              <span>
                {formatoMoneda.format(totales.ganancia)} ({totales.margenPct.toFixed(1)}%)
              </span>
            </div>
          )}
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
            {config?.habilitarFiado && <option value="CREDITO">Fiado (crédito)</option>}
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

        {metodoPago === "CREDITO" && (
          <div className={`mt-2 rounded-lg border p-2 text-sm ${fiadoInvalido ? "border-red-300 bg-red-50 text-red-700" : "border-blue-200 bg-blue-50 text-blue-700"}`}>
            {!cliente || cliente.esConsumidorFinal ? (
              <p>Selecciona un cliente identificado arriba para poder fiarle.</p>
            ) : cliente.limiteCredito <= 0 ? (
              <p>{cliente.nombre} no tiene cupo de fiado habilitado (edítalo en Clientes).</p>
            ) : (
              <>
                <p>
                  {cliente.nombre} debe hoy {formatoMoneda.format(cliente.saldoPendiente)} · Cupo disponible:{" "}
                  {formatoMoneda.format(Math.max(0, cupoDisponible))}
                </p>
                {totales.total > cupoDisponible && <p className="font-semibold">Esta venta supera el cupo disponible.</p>}
              </>
            )}
          </div>
        )}

        <button
          onClick={alHacerClicCobrar}
          disabled={carrito.length === 0 || procesando || fiadoInvalido}
          className="mt-4 rounded-lg bg-green-700 py-3 text-lg font-bold text-white hover:bg-green-800 disabled:opacity-50"
        >
          {procesando
            ? "Procesando..."
            : metodoPago === "CREDITO"
              ? `Fiar ${formatoMoneda.format(totales.total)}`
              : metodoPago === "TARJETA"
                ? `Cobrar en datáfono ${formatoMoneda.format(totales.total)}`
                : `Cobrar ${formatoMoneda.format(totales.total)}`}
        </button>
        <p className="mt-1.5 text-center text-[11px] text-stone-400">F2 escanear · F9 cobrar · Esc cancelar</p>
      </div>

      {modalLibreAbierto && (
        <ProductoLibreModal onGuardar={agregarProductoLibre} onCerrar={() => setModalLibreAbierto(false)} />
      )}

      {pantallaCobroAbierta && config && (
        <PantallaCobro
          monto={totales.total}
          referencia={`POS-${Date.now()}`}
          config={config}
          onCancelar={() => setPantallaCobroAbierta(false)}
          onConfirmar={() => {
            setPantallaCobroAbierta(false);
            cobrar();
          }}
        />
      )}
    </div>
  );
}
