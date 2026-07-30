// Capa de facturación electrónica DIAN.
//
// Construir desde cero la firma digital XAdES, el XML UBL 2.1 y el proceso de
// habilitación ante la DIAN es un proyecto de certificación legal aparte (toma
// semanas y exige que el negocio ya tenga NIT, certificado digital y una
// resolución de numeración vigente). En su lugar, esta capa define una
// interfaz "InvoicingProvider" y delega la emisión real a un proveedor
// tecnológico autorizado por la DIAN (facturador electrónico habilitado).
//
// Mientras el negocio no tenga ese proveedor contratado, se usa
// InternalPosProvider, que emite el "documento equivalente POS" (Resolución
// DIAN 000165 de 2023): un comprobante de venta válido para el día a día que
// NO sustituye la factura electrónica, pero tampoco la requiere legalmente
// por debajo de ciertos topes de venta. Cuando el negocio active la
// facturación electrónica en Configuración con credenciales de un proveedor
// (por ahora se incluye un conector de referencia para Factus), las ventas
// se facturan automáticamente ante la DIAN.

import type { Cliente, Configuracion, Producto, Venta, VentaItem } from "@prisma/client";

export interface VentaParaFacturar extends Venta {
  items: (VentaItem & { producto: Producto })[];
  cliente: Cliente | null;
}

export interface ResultadoEmision {
  tipoDocumento: "DOCUMENTO_POS" | "FACTURA_ELECTRONICA";
  proveedor: string;
  cufe?: string;
  urlQr?: string;
}

export interface InvoicingProvider {
  nombre: string;
  emitir(venta: VentaParaFacturar, config: Configuracion): Promise<ResultadoEmision>;
}

// ---------------------------------------------------------------------------
// Proveedor interno: documento equivalente POS (sin conexión a la DIAN)
// ---------------------------------------------------------------------------
export class InternalPosProvider implements InvoicingProvider {
  nombre = "NINGUNO";

  async emitir(): Promise<ResultadoEmision> {
    return { tipoDocumento: "DOCUMENTO_POS", proveedor: "NINGUNO" };
  }
}

// ---------------------------------------------------------------------------
// Conector de referencia para Factus (proveedor tecnológico autorizado DIAN).
//
// IMPORTANTE: este cliente sigue el contrato público de la API de Factus
// (OAuth2 client_credentials + POST /v1/bills) vigente al momento de escribir
// esto. Antes de usarlo en producción, verifica el contrato actual en su
// documentación oficial (https://developers.factus.com.co) porque las APIs de
// facturación evolucionan. Se activa poniendo proveedorFacturacion="FACTUS" y
// las credenciales (proveedorApiUrl, proveedorApiKey, proveedorApiSecret) en
// Configuración.
// ---------------------------------------------------------------------------
export class FactusProvider implements InvoicingProvider {
  nombre = "FACTUS";

  private async obtenerToken(config: Configuracion): Promise<string> {
    const url = `${config.proveedorApiUrl}/oauth/token`;
    const resp = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        grant_type: "client_credentials",
        client_id: config.proveedorApiKey,
        client_secret: config.proveedorApiSecret,
      }),
    });
    if (!resp.ok) {
      throw new Error(`No se pudo autenticar con el proveedor de facturación (HTTP ${resp.status})`);
    }
    const data = (await resp.json()) as { access_token: string };
    return data.access_token;
  }

  async emitir(venta: VentaParaFacturar, config: Configuracion): Promise<ResultadoEmision> {
    if (!config.proveedorApiUrl || !config.proveedorApiKey || !config.proveedorApiSecret) {
      throw new Error("Faltan credenciales del proveedor de facturación electrónica en Configuración");
    }

    const token = await this.obtenerToken(config);

    const cliente = venta.cliente;
    const payload = {
      numbering_range_id: config.resolucionDianPrefijo ?? undefined,
      reference_code: `${venta.prefijo}-${venta.numero}`,
      payment_form: venta.metodoPago === "EFECTIVO" ? "1" : "2",
      customer: {
        identification: cliente?.numeroDocumento ?? "222222222222",
        names: cliente?.nombre ?? "Consumidor Final",
        email: cliente?.email ?? undefined,
        phone: cliente?.telefono ?? undefined,
      },
      items: venta.items.map((item) => ({
        code_reference: item.producto.codigoBarras ?? String(item.productoId),
        name: item.nombreProducto,
        quantity: item.cantidad,
        price: item.precioUnitario,
        tax_rate: item.ivaTasa,
        discount: item.descuento,
      })),
    };

    const resp = await fetch(`${config.proveedorApiUrl}/v1/bills`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(payload),
    });

    if (!resp.ok) {
      const texto = await resp.text().catch(() => "");
      throw new Error(`El proveedor rechazó la factura (HTTP ${resp.status}): ${texto}`);
    }

    const data = (await resp.json()) as { data?: { bill?: { cufe?: string; qr?: string } } };
    const cufe = data.data?.bill?.cufe;
    const urlQr = data.data?.bill?.qr;

    if (!cufe) {
      throw new Error("El proveedor no devolvió un CUFE válido");
    }

    return { tipoDocumento: "FACTURA_ELECTRONICA", proveedor: "FACTUS", cufe, urlQr };
  }
}

export function getInvoicingProvider(config: Configuracion): InvoicingProvider {
  if (config.facturacionElectronicaHabilitada && config.proveedorFacturacion === "FACTUS") {
    return new FactusProvider();
  }
  return new InternalPosProvider();
}
