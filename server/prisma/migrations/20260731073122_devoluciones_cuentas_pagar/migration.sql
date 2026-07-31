-- CreateTable
CREATE TABLE "MovimientoCuentaProveedor" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "proveedorId" INTEGER NOT NULL,
    "tipo" TEXT NOT NULL,
    "monto" REAL NOT NULL,
    "saldoResultante" REAL NOT NULL,
    "motivo" TEXT,
    "usuarioId" INTEGER NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "MovimientoCuentaProveedor_proveedorId_fkey" FOREIGN KEY ("proveedorId") REFERENCES "Proveedor" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "MovimientoCuentaProveedor_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "Usuario" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Devolucion" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "ventaId" INTEGER NOT NULL,
    "monto" REAL NOT NULL,
    "motivo" TEXT NOT NULL,
    "usuarioId" INTEGER NOT NULL,
    "turnoId" INTEGER,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Devolucion_ventaId_fkey" FOREIGN KEY ("ventaId") REFERENCES "Venta" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Devolucion_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "Usuario" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Devolucion_turnoId_fkey" FOREIGN KEY ("turnoId") REFERENCES "Turno" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "DevolucionItem" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "devolucionId" INTEGER NOT NULL,
    "ventaItemId" INTEGER NOT NULL,
    "cantidad" REAL NOT NULL,
    "monto" REAL NOT NULL,
    CONSTRAINT "DevolucionItem_devolucionId_fkey" FOREIGN KEY ("devolucionId") REFERENCES "Devolucion" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "DevolucionItem_ventaItemId_fkey" FOREIGN KEY ("ventaItemId") REFERENCES "VentaItem" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Proveedor" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "nombre" TEXT NOT NULL,
    "telefono" TEXT,
    "direccion" TEXT,
    "notas" TEXT,
    "saldoPendiente" REAL NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
INSERT INTO "new_Proveedor" ("createdAt", "direccion", "id", "nombre", "notas", "telefono") SELECT "createdAt", "direccion", "id", "nombre", "notas", "telefono" FROM "Proveedor";
DROP TABLE "Proveedor";
ALTER TABLE "new_Proveedor" RENAME TO "Proveedor";
CREATE UNIQUE INDEX "Proveedor_nombre_key" ON "Proveedor"("nombre");
CREATE TABLE "new_Venta" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "numero" INTEGER NOT NULL,
    "prefijo" TEXT NOT NULL DEFAULT 'POS',
    "clienteId" INTEGER,
    "usuarioId" INTEGER NOT NULL,
    "subtotal" REAL NOT NULL,
    "descuento" REAL NOT NULL DEFAULT 0,
    "ivaTotal" REAL NOT NULL DEFAULT 0,
    "total" REAL NOT NULL,
    "metodoPago" TEXT NOT NULL DEFAULT 'EFECTIVO',
    "efectivoRecibido" REAL,
    "cambio" REAL,
    "estado" TEXT NOT NULL DEFAULT 'COMPLETADA',
    "tipoDocumento" TEXT NOT NULL DEFAULT 'DOCUMENTO_POS',
    "cufe" TEXT,
    "urlQr" TEXT,
    "proveedorFactura" TEXT,
    "motivoAnulacion" TEXT,
    "turnoId" INTEGER,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "totalDevuelto" REAL NOT NULL DEFAULT 0,
    CONSTRAINT "Venta_clienteId_fkey" FOREIGN KEY ("clienteId") REFERENCES "Cliente" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Venta_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "Usuario" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Venta_turnoId_fkey" FOREIGN KEY ("turnoId") REFERENCES "Turno" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_Venta" ("cambio", "clienteId", "createdAt", "cufe", "descuento", "efectivoRecibido", "estado", "id", "ivaTotal", "metodoPago", "motivoAnulacion", "numero", "prefijo", "proveedorFactura", "subtotal", "tipoDocumento", "total", "turnoId", "urlQr", "usuarioId") SELECT "cambio", "clienteId", "createdAt", "cufe", "descuento", "efectivoRecibido", "estado", "id", "ivaTotal", "metodoPago", "motivoAnulacion", "numero", "prefijo", "proveedorFactura", "subtotal", "tipoDocumento", "total", "turnoId", "urlQr", "usuarioId" FROM "Venta";
DROP TABLE "Venta";
ALTER TABLE "new_Venta" RENAME TO "Venta";
CREATE INDEX "Venta_createdAt_idx" ON "Venta"("createdAt");
CREATE UNIQUE INDEX "Venta_prefijo_numero_key" ON "Venta"("prefijo", "numero");
CREATE TABLE "new_VentaItem" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "ventaId" INTEGER NOT NULL,
    "productoId" INTEGER,
    "nombreProducto" TEXT NOT NULL,
    "cantidad" REAL NOT NULL,
    "precioUnitario" REAL NOT NULL,
    "costoUnitarioLibre" REAL,
    "ivaTasa" INTEGER NOT NULL DEFAULT 0,
    "descuento" REAL NOT NULL DEFAULT 0,
    "subtotal" REAL NOT NULL,
    "cantidadDevuelta" REAL NOT NULL DEFAULT 0,
    CONSTRAINT "VentaItem_ventaId_fkey" FOREIGN KEY ("ventaId") REFERENCES "Venta" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "VentaItem_productoId_fkey" FOREIGN KEY ("productoId") REFERENCES "Producto" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_VentaItem" ("cantidad", "costoUnitarioLibre", "descuento", "id", "ivaTasa", "nombreProducto", "precioUnitario", "productoId", "subtotal", "ventaId") SELECT "cantidad", "costoUnitarioLibre", "descuento", "id", "ivaTasa", "nombreProducto", "precioUnitario", "productoId", "subtotal", "ventaId" FROM "VentaItem";
DROP TABLE "VentaItem";
ALTER TABLE "new_VentaItem" RENAME TO "VentaItem";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE INDEX "MovimientoCuentaProveedor_proveedorId_idx" ON "MovimientoCuentaProveedor"("proveedorId");

-- CreateIndex
CREATE INDEX "MovimientoCuentaProveedor_createdAt_idx" ON "MovimientoCuentaProveedor"("createdAt");

