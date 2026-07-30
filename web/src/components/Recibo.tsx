import type { Configuracion, Venta } from "../types";
import { UNIDAD_LABELS } from "../types";

const formatoMoneda = new Intl.NumberFormat("es-CO", {
  style: "currency",
  currency: "COP",
  maximumFractionDigits: 0,
});

export function Recibo({ venta, config }: { venta: Venta; config: Configuracion }) {
  const ancho = config.formatoRecibo === "58MM" ? "max-w-[220px]" : "max-w-[300px]";
  const esFactura = venta.tipoDocumento === "FACTURA_ELECTRONICA";

  return (
    <div className={`recibo-imprimible mx-auto ${ancho} bg-white p-2 font-mono text-[11px] leading-tight text-black`}>
      <div className="text-center">
        <p className="text-sm font-bold">{config.nombreNegocio}</p>
        {config.nit && <p>NIT: {config.nit}</p>}
        <p>{config.direccion}</p>
        {config.telefono && <p>Tel: {config.telefono}</p>}
      </div>

      <div className="my-2 border-t border-dashed border-black" />

      <p className="text-center font-semibold">
        {esFactura ? "FACTURA ELECTRÓNICA DE VENTA" : "DOCUMENTO EQUIVALENTE POS"}
      </p>
      <p className="text-center">
        No. {venta.prefijo}-{venta.numero}
      </p>
      <p>Fecha: {new Date(venta.createdAt).toLocaleString("es-CO")}</p>
      <p>Atendió: {venta.usuario?.nombre ?? "-"}</p>
      <p>Cliente: {venta.cliente?.nombre ?? "Consumidor Final"}</p>
      {venta.cliente && venta.cliente.numeroDocumento !== "222222222222" && (
        <p>
          {venta.cliente.tipoDocumento}: {venta.cliente.numeroDocumento}
        </p>
      )}

      <div className="my-2 border-t border-dashed border-black" />

      {venta.items.map((item) => (
        <div key={item.id} className="mb-1">
          <p>{item.nombreProducto}</p>
          <div className="flex justify-between">
            <span>
              {item.cantidad} {UNIDAD_LABELS[item.producto?.unidad ?? "UNIDAD"]} x {formatoMoneda.format(item.precioUnitario)}
            </span>
            <span>{formatoMoneda.format(item.subtotal)}</span>
          </div>
        </div>
      ))}

      <div className="my-2 border-t border-dashed border-black" />

      <div className="flex justify-between">
        <span>Subtotal</span>
        <span>{formatoMoneda.format(venta.subtotal)}</span>
      </div>
      {venta.descuento > 0 && (
        <div className="flex justify-between">
          <span>Descuento</span>
          <span>-{formatoMoneda.format(venta.descuento)}</span>
        </div>
      )}
      <div className="flex justify-between">
        <span>IVA</span>
        <span>{formatoMoneda.format(venta.ivaTotal)}</span>
      </div>
      <div className="flex justify-between text-sm font-bold">
        <span>TOTAL</span>
        <span>{formatoMoneda.format(venta.total)}</span>
      </div>

      <div className="my-2 border-t border-dashed border-black" />

      <p>Forma de pago: {venta.metodoPago}</p>
      {venta.efectivoRecibido != null && (
        <>
          <div className="flex justify-between">
            <span>Recibido</span>
            <span>{formatoMoneda.format(venta.efectivoRecibido)}</span>
          </div>
          <div className="flex justify-between">
            <span>Cambio</span>
            <span>{formatoMoneda.format(venta.cambio ?? 0)}</span>
          </div>
        </>
      )}

      <div className="my-2 border-t border-dashed border-black" />

      {esFactura ? (
        <div className="text-center">
          {venta.cufe && <p className="break-all">CUFE: {venta.cufe}</p>}
          {venta.urlQr && (
            <img
              src={venta.urlQr.startsWith("http") ? venta.urlQr : `data:image/png;base64,${venta.urlQr}`}
              alt="Código QR de la factura"
              className="mx-auto my-2 h-24 w-24"
            />
          )}
          <p>Factura electrónica generada vía {venta.proveedorFactura}</p>
        </div>
      ) : (
        <p className="text-center">
          Documento equivalente POS. No es una factura electrónica y no da derecho a impuestos descontables.
        </p>
      )}

      <p className="mt-2 text-center font-semibold">¡Gracias por su compra!</p>
    </div>
  );
}
