export type Rol = "ADMIN" | "CAJERO";

export interface Usuario {
  id: number;
  nombre: string;
  email: string;
  rol: Rol;
  activo?: boolean;
}

export type Unidad = "UNIDAD" | "PAQUETE" | "CAJA" | "KILOGRAMO" | "GRAMO" | "LIBRA" | "LITRO";

export const UNIDAD_LABELS: Record<Unidad, string> = {
  UNIDAD: "Unidad",
  PAQUETE: "Paquete",
  CAJA: "Caja",
  KILOGRAMO: "Kilogramo",
  GRAMO: "Gramo",
  LIBRA: "Libra",
  LITRO: "Litro",
};

export interface Categoria {
  id: number;
  nombre: string;
  _count?: { productos: number };
}

export interface Producto {
  id: number;
  codigoBarras: string | null;
  nombre: string;
  descripcion: string | null;
  categoriaId: number | null;
  categoria: Categoria | null;
  unidad: Unidad;
  precioCosto: number;
  precioVenta: number;
  ivaTasa: number;
  stock: number;
  stockMinimo: number;
  activo: boolean;
  createdAt: string;
  updatedAt: string;
}

export type TipoMovimiento = "ENTRADA" | "SALIDA" | "AJUSTE" | "VENTA" | "DEVOLUCION";

export interface MovimientoInventario {
  id: number;
  productoId: number;
  producto?: { nombre: string; unidad: Unidad };
  tipo: TipoMovimiento;
  cantidad: number;
  costoUnitario: number | null;
  motivo: string | null;
  usuario?: { nombre: string } | null;
  createdAt: string;
}

export type TipoDocumentoCliente = "CC" | "NIT" | "CE" | "PASAPORTE";

export interface Cliente {
  id: number;
  tipoDocumento: TipoDocumentoCliente;
  numeroDocumento: string;
  nombre: string;
  telefono: string | null;
  email: string | null;
  direccion: string | null;
  esConsumidorFinal: boolean;
}

export type MetodoPago = "EFECTIVO" | "TARJETA" | "TRANSFERENCIA" | "MIXTO";
export type EstadoVenta = "COMPLETADA" | "ANULADA";
export type TipoDocumentoVenta = "DOCUMENTO_POS" | "FACTURA_ELECTRONICA";

export interface VentaItem {
  id: number;
  productoId: number;
  producto: Producto;
  nombreProducto: string;
  cantidad: number;
  precioUnitario: number;
  ivaTasa: number;
  descuento: number;
  subtotal: number;
}

export interface Venta {
  id: number;
  numero: number;
  prefijo: string;
  clienteId: number | null;
  cliente: Cliente | null;
  usuario?: { nombre: string };
  subtotal: number;
  descuento: number;
  ivaTotal: number;
  total: number;
  metodoPago: MetodoPago;
  efectivoRecibido: number | null;
  cambio: number | null;
  estado: EstadoVenta;
  tipoDocumento: TipoDocumentoVenta;
  cufe: string | null;
  urlQr: string | null;
  proveedorFactura: string | null;
  motivoAnulacion: string | null;
  createdAt: string;
  items: VentaItem[];
}

export interface Configuracion {
  id: number;
  nombreNegocio: string;
  nit: string | null;
  direccion: string;
  telefono: string | null;
  ciudad: string;
  resolucionDianNumero: string | null;
  resolucionDianPrefijo: string | null;
  resolucionDianDesde: number | null;
  resolucionDianHasta: number | null;
  resolucionDianVigenciaDesde: string | null;
  resolucionDianVigenciaHasta: string | null;
  facturacionElectronicaHabilitada: boolean;
  proveedorFacturacion: "NINGUNO" | "FACTUS";
  proveedorApiUrl: string | null;
  proveedorApiKey: string | null;
  proveedorApiSecretConfigurado: boolean;
  formatoRecibo: "58MM" | "80MM";
}

export interface ResumenReporte {
  numeroVentas: number;
  totalVentas: number;
  totalIva: number;
  ganancia: number;
  unidadesVendidas: number;
  ticketPromedio: number;
}

export interface TopProducto {
  productoId: number;
  nombre: string;
  cantidad: number;
  total: number;
}
