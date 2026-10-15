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

export interface Proveedor {
  id: number;
  nombre: string;
  telefono: string | null;
  direccion: string | null;
  notas: string | null;
  saldoPendiente: number;
  _count?: { productos: number };
}

export type TipoMovimientoCuentaProveedor = "CARGO" | "ABONO" | "AJUSTE";

export interface MovimientoCuentaProveedor {
  id: number;
  proveedorId: number;
  tipo: TipoMovimientoCuentaProveedor;
  monto: number;
  saldoResultante: number;
  motivo: string | null;
  usuario?: { nombre: string };
  createdAt: string;
}

export interface EstadoCuentaProveedor {
  proveedor: Proveedor;
  movimientos: MovimientoCuentaProveedor[];
}

export interface ResumenCuentasPorPagar {
  total: number;
  numeroProveedores: number;
  proveedores: { proveedorId: number; nombre: string; telefono: string | null; saldoPendiente: number }[];
}

export interface Producto {
  id: number;
  codigoBarras: string | null;
  nombre: string;
  descripcion: string | null;
  categoriaId: number | null;
  categoria: Categoria | null;
  proveedorId: number | null;
  proveedor: Proveedor | null;
  unidad: Unidad;
  precioCosto: number;
  precioVenta: number;
  precioMayorista: number | null;
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
export type TipoCliente = "DETAL" | "MAYORISTA";

export interface Cliente {
  id: number;
  tipoDocumento: TipoDocumentoCliente;
  numeroDocumento: string;
  nombre: string;
  telefono: string | null;
  email: string | null;
  direccion: string | null;
  esConsumidorFinal: boolean;
  tipoCliente: TipoCliente;
  limiteCredito: number;
  saldoPendiente: number;
  diasPlazoCredito: number;
  estudioCreditoAprobado: boolean;
  estudioCreditoAprobadoPorId: number | null;
  estudioCreditoAprobadoEn: string | null;
  estudioCreditoNotas: string | null;
  codeudores?: Codeudor[];
  referencias?: ReferenciaCliente[];
}

export type TipoReferencia = "PERSONAL" | "COMERCIAL";

export interface Codeudor {
  id: number;
  clienteId: number;
  nombre: string;
  tipoDocumento: TipoDocumentoCliente;
  numeroDocumento: string;
  telefono: string;
  direccion: string | null;
  parentesco: string | null;
  createdAt: string;
}

export interface ReferenciaCliente {
  id: number;
  clienteId: number;
  tipo: TipoReferencia;
  nombre: string;
  telefono: string;
  relacion: string | null;
  createdAt: string;
}

export type MetodoPago = "EFECTIVO" | "TARJETA" | "TRANSFERENCIA" | "MIXTO" | "CREDITO";
export type EstadoVenta = "COMPLETADA" | "ANULADA";
export type TipoDocumentoVenta = "DOCUMENTO_POS" | "FACTURA_ELECTRONICA";

export interface VentaItem {
  id: number;
  productoId: number | null;
  producto: Producto | null;
  nombreProducto: string;
  cantidad: number;
  precioUnitario: number;
  costoUnitarioLibre: number | null;
  ivaTasa: number;
  descuento: number;
  subtotal: number;
  cantidadDevuelta: number;
}

export interface DevolucionItem {
  id: number;
  ventaItemId: number;
  cantidad: number;
  monto: number;
}

export interface Devolucion {
  id: number;
  ventaId: number;
  monto: number;
  motivo: string;
  usuario?: { nombre: string };
  createdAt: string;
  items: DevolucionItem[];
}

export type TipoMovimientoCuenta = "CARGO" | "ABONO" | "AJUSTE";

export interface CuentaCorrienteMovimiento {
  id: number;
  clienteId: number;
  tipo: TipoMovimientoCuenta;
  monto: number;
  saldoResultante: number;
  ventaId: number | null;
  metodoPago: string | null;
  motivo: string | null;
  usuario?: { nombre: string };
  createdAt: string;
}

export interface EstadoCuentaCliente {
  cliente: Cliente;
  movimientos: CuentaCorrienteMovimiento[];
  ventasCredito: { total: number; createdAt: string }[];
  diasVencido: number;
}

export interface ResumenCartera {
  totalCartera: number;
  totalVencido: number;
  numeroClientes: number;
  diasParaVencido: number;
  clientes: { clienteId: number; nombre: string; telefono: string | null; saldoPendiente: number; diasVencido: number }[];
}

export interface LoteInventario {
  id: number;
  productoId: number;
  producto?: { nombre: string; unidad: Unidad; codigoBarras: string | null };
  fechaVencimiento: string | null;
  cantidadInicial: number;
  cantidadDisponible: number;
  costoUnitario: number;
  motivo: string | null;
  activo: boolean;
  createdAt: string;
  vencido?: boolean;
}

export interface ResumenVencimientos {
  porVencer: number;
  vencidos: number;
}

export interface Turno {
  id: number;
  usuarioId: number;
  usuario?: { nombre: string };
  fondoInicial: number;
  abiertoEn: string;
  cerradoEn: string | null;
  efectivoContado: number | null;
  efectivoEsperado: number | null;
  diferencia: number | null;
  notas: string | null;
}

export interface ResumenTurno {
  turno: Turno;
  totalVentasEfectivo: number;
  totalAbonosEfectivo: number;
  totalDevolucionesEfectivo: number;
  efectivoEsperado: number;
  numeroVentas: number;
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
  totalDevuelto: number;
  createdAt: string;
  items: VentaItem[];
  devoluciones: Devolucion[];
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
  tipoNegocio: string;
  limiteCreditoPorDefecto: number;
  diasPlazoCreditoPorDefecto: number;
  diasParaVencido: number;
  margenAlertaPct: number;
  descuentoMaximoPct: number;
  habilitarFiado: boolean;
  diasAlertaVencimiento: number;
  proveedorDatafono: "NINGUNO" | "BOLD";
  datafonoApiUrl: string | null;
  datafonoApiKey: string | null;
  datafonoApiSecretConfigurado: boolean;
  fondoCajaSugerido: number;
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
