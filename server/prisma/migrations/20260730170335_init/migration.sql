-- CreateTable
CREATE TABLE "Usuario" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "nombre" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "rol" TEXT NOT NULL DEFAULT 'CAJERO',
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "Categoria" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "nombre" TEXT NOT NULL
);

-- CreateTable
CREATE TABLE "Producto" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "codigoBarras" TEXT,
    "nombre" TEXT NOT NULL,
    "descripcion" TEXT,
    "categoriaId" INTEGER,
    "unidad" TEXT NOT NULL DEFAULT 'UNIDAD',
    "precioCosto" REAL NOT NULL DEFAULT 0,
    "precioVenta" REAL NOT NULL,
    "precioMayorista" REAL,
    "ivaTasa" INTEGER NOT NULL DEFAULT 0,
    "stock" REAL NOT NULL DEFAULT 0,
    "stockMinimo" REAL NOT NULL DEFAULT 0,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "imagenUrl" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Producto_categoriaId_fkey" FOREIGN KEY ("categoriaId") REFERENCES "Categoria" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "MovimientoInventario" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "productoId" INTEGER NOT NULL,
    "tipo" TEXT NOT NULL,
    "cantidad" REAL NOT NULL,
    "costoUnitario" REAL,
    "motivo" TEXT,
    "usuarioId" INTEGER,
    "ventaId" INTEGER,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "MovimientoInventario_productoId_fkey" FOREIGN KEY ("productoId") REFERENCES "Producto" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "MovimientoInventario_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "Usuario" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "MovimientoInventario_ventaId_fkey" FOREIGN KEY ("ventaId") REFERENCES "Venta" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Cliente" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "tipoDocumento" TEXT NOT NULL DEFAULT 'CC',
    "numeroDocumento" TEXT NOT NULL DEFAULT '222222222222',
    "nombre" TEXT NOT NULL DEFAULT 'Consumidor Final',
    "telefono" TEXT,
    "email" TEXT,
    "direccion" TEXT,
    "esConsumidorFinal" BOOLEAN NOT NULL DEFAULT true,
    "tipoCliente" TEXT NOT NULL DEFAULT 'DETAL',
    "limiteCredito" REAL NOT NULL DEFAULT 0,
    "saldoPendiente" REAL NOT NULL DEFAULT 0,
    "diasPlazoCredito" INTEGER NOT NULL DEFAULT 30,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "CuentaCorrienteMovimiento" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "clienteId" INTEGER NOT NULL,
    "tipo" TEXT NOT NULL,
    "monto" REAL NOT NULL,
    "saldoResultante" REAL NOT NULL,
    "ventaId" INTEGER,
    "metodoPago" TEXT,
    "motivo" TEXT,
    "usuarioId" INTEGER NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "CuentaCorrienteMovimiento_clienteId_fkey" FOREIGN KEY ("clienteId") REFERENCES "Cliente" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "CuentaCorrienteMovimiento_ventaId_fkey" FOREIGN KEY ("ventaId") REFERENCES "Venta" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "CuentaCorrienteMovimiento_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "Usuario" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Venta" (
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
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Venta_clienteId_fkey" FOREIGN KEY ("clienteId") REFERENCES "Cliente" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Venta_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "Usuario" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "VentaItem" (
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
    CONSTRAINT "VentaItem_ventaId_fkey" FOREIGN KEY ("ventaId") REFERENCES "Venta" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "VentaItem_productoId_fkey" FOREIGN KEY ("productoId") REFERENCES "Producto" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Configuracion" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT DEFAULT 1,
    "nombreNegocio" TEXT NOT NULL DEFAULT 'San Miguel',
    "nit" TEXT,
    "direccion" TEXT NOT NULL DEFAULT 'Cra 43 con Calle 8, Mercado de Barranquilla',
    "telefono" TEXT,
    "ciudad" TEXT NOT NULL DEFAULT 'Barranquilla',
    "resolucionDianNumero" TEXT,
    "resolucionDianPrefijo" TEXT,
    "resolucionDianDesde" INTEGER,
    "resolucionDianHasta" INTEGER,
    "resolucionDianVigenciaDesde" DATETIME,
    "resolucionDianVigenciaHasta" DATETIME,
    "facturacionElectronicaHabilitada" BOOLEAN NOT NULL DEFAULT false,
    "proveedorFacturacion" TEXT NOT NULL DEFAULT 'NINGUNO',
    "proveedorApiUrl" TEXT,
    "proveedorApiKey" TEXT,
    "proveedorApiSecret" TEXT,
    "formatoRecibo" TEXT NOT NULL DEFAULT '80MM',
    "tipoNegocio" TEXT NOT NULL DEFAULT 'OTRO',
    "limiteCreditoPorDefecto" REAL NOT NULL DEFAULT 0,
    "diasPlazoCreditoPorDefecto" INTEGER NOT NULL DEFAULT 30,
    "diasParaVencido" INTEGER NOT NULL DEFAULT 30,
    "margenAlertaPct" REAL NOT NULL DEFAULT 8,
    "descuentoMaximoCajeroPct" REAL NOT NULL DEFAULT 5
);

-- CreateIndex
CREATE UNIQUE INDEX "Usuario_email_key" ON "Usuario"("email");

-- CreateIndex
CREATE UNIQUE INDEX "Categoria_nombre_key" ON "Categoria"("nombre");

-- CreateIndex
CREATE UNIQUE INDEX "Producto_codigoBarras_key" ON "Producto"("codigoBarras");

-- CreateIndex
CREATE INDEX "Producto_nombre_idx" ON "Producto"("nombre");

-- CreateIndex
CREATE INDEX "MovimientoInventario_productoId_idx" ON "MovimientoInventario"("productoId");

-- CreateIndex
CREATE INDEX "MovimientoInventario_createdAt_idx" ON "MovimientoInventario"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "Cliente_tipoDocumento_numeroDocumento_key" ON "Cliente"("tipoDocumento", "numeroDocumento");

-- CreateIndex
CREATE INDEX "CuentaCorrienteMovimiento_clienteId_idx" ON "CuentaCorrienteMovimiento"("clienteId");

-- CreateIndex
CREATE INDEX "CuentaCorrienteMovimiento_createdAt_idx" ON "CuentaCorrienteMovimiento"("createdAt");

-- CreateIndex
CREATE INDEX "Venta_createdAt_idx" ON "Venta"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "Venta_prefijo_numero_key" ON "Venta"("prefijo", "numero");
