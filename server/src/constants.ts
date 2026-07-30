// "Enums" del dominio. SQLite no soporta enums nativos en Prisma, así que se
// modelan como String en el schema y se validan aquí en la capa de aplicación.

export const ROLES = ["ADMIN", "CAJERO"] as const;
export type Rol = (typeof ROLES)[number];

export const UNIDADES = [
  "UNIDAD",
  "PAQUETE",
  "CAJA",
  "KILOGRAMO",
  "GRAMO",
  "LIBRA",
  "LITRO",
] as const;
export type Unidad = (typeof UNIDADES)[number];

// Tarifas de IVA vigentes en Colombia aplicables a bienes de consumo típicos
// de una salsamentaria (0% excluido/exento, 5% y 19% general).
export const IVA_TASAS = [0, 5, 19] as const;

export const TIPOS_MOVIMIENTO = [
  "ENTRADA",
  "SALIDA",
  "AJUSTE",
  "VENTA",
  "DEVOLUCION",
] as const;
export type TipoMovimiento = (typeof TIPOS_MOVIMIENTO)[number];

export const TIPOS_DOCUMENTO_CLIENTE = ["CC", "NIT", "CE", "PASAPORTE"] as const;

export const METODOS_PAGO = ["EFECTIVO", "TARJETA", "TRANSFERENCIA", "MIXTO"] as const;
export type MetodoPago = (typeof METODOS_PAGO)[number];

export const ESTADOS_VENTA = ["COMPLETADA", "ANULADA"] as const;

export const TIPOS_DOCUMENTO_VENTA = ["DOCUMENTO_POS", "FACTURA_ELECTRONICA"] as const;

export const PROVEEDORES_FACTURACION = ["NINGUNO", "FACTUS"] as const;

export const CONSUMIDOR_FINAL = {
  tipoDocumento: "CC" as const,
  numeroDocumento: "222222222222",
  nombre: "Consumidor Final",
};
