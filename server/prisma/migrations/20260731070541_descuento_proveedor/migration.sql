-- CreateTable
CREATE TABLE "Proveedor" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "nombre" TEXT NOT NULL,
    "telefono" TEXT,
    "direccion" TEXT,
    "notas" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Configuracion" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT DEFAULT 1,
    "nombreNegocio" TEXT NOT NULL DEFAULT 'Surtidesechables San Miguel Arcángel',
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
    "descuentoMaximoPct" REAL NOT NULL DEFAULT 3,
    "habilitarFiado" BOOLEAN NOT NULL DEFAULT true,
    "diasAlertaVencimiento" INTEGER NOT NULL DEFAULT 7,
    "proveedorDatafono" TEXT NOT NULL DEFAULT 'NINGUNO',
    "datafonoApiUrl" TEXT,
    "datafonoApiKey" TEXT,
    "datafonoApiSecret" TEXT,
    "fondoCajaSugerido" REAL NOT NULL DEFAULT 0,
    "ultimoNumeroVentaPos" INTEGER NOT NULL DEFAULT 0
);
INSERT INTO "new_Configuracion" ("ciudad", "datafonoApiKey", "datafonoApiSecret", "datafonoApiUrl", "diasAlertaVencimiento", "diasParaVencido", "diasPlazoCreditoPorDefecto", "direccion", "facturacionElectronicaHabilitada", "fondoCajaSugerido", "formatoRecibo", "habilitarFiado", "id", "limiteCreditoPorDefecto", "margenAlertaPct", "nit", "nombreNegocio", "proveedorApiKey", "proveedorApiSecret", "proveedorApiUrl", "proveedorDatafono", "proveedorFacturacion", "resolucionDianDesde", "resolucionDianHasta", "resolucionDianNumero", "resolucionDianPrefijo", "resolucionDianVigenciaDesde", "resolucionDianVigenciaHasta", "telefono", "tipoNegocio", "ultimoNumeroVentaPos") SELECT "ciudad", "datafonoApiKey", "datafonoApiSecret", "datafonoApiUrl", "diasAlertaVencimiento", "diasParaVencido", "diasPlazoCreditoPorDefecto", "direccion", "facturacionElectronicaHabilitada", "fondoCajaSugerido", "formatoRecibo", "habilitarFiado", "id", "limiteCreditoPorDefecto", "margenAlertaPct", "nit", "nombreNegocio", "proveedorApiKey", "proveedorApiSecret", "proveedorApiUrl", "proveedorDatafono", "proveedorFacturacion", "resolucionDianDesde", "resolucionDianHasta", "resolucionDianNumero", "resolucionDianPrefijo", "resolucionDianVigenciaDesde", "resolucionDianVigenciaHasta", "telefono", "tipoNegocio", "ultimoNumeroVentaPos" FROM "Configuracion";
DROP TABLE "Configuracion";
ALTER TABLE "new_Configuracion" RENAME TO "Configuracion";
CREATE TABLE "new_Producto" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "codigoBarras" TEXT,
    "nombre" TEXT NOT NULL,
    "descripcion" TEXT,
    "categoriaId" INTEGER,
    "proveedorId" INTEGER,
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
    CONSTRAINT "Producto_categoriaId_fkey" FOREIGN KEY ("categoriaId") REFERENCES "Categoria" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Producto_proveedorId_fkey" FOREIGN KEY ("proveedorId") REFERENCES "Proveedor" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_Producto" ("activo", "categoriaId", "codigoBarras", "createdAt", "descripcion", "id", "imagenUrl", "ivaTasa", "nombre", "precioCosto", "precioMayorista", "precioVenta", "stock", "stockMinimo", "unidad", "updatedAt") SELECT "activo", "categoriaId", "codigoBarras", "createdAt", "descripcion", "id", "imagenUrl", "ivaTasa", "nombre", "precioCosto", "precioMayorista", "precioVenta", "stock", "stockMinimo", "unidad", "updatedAt" FROM "Producto";
DROP TABLE "Producto";
ALTER TABLE "new_Producto" RENAME TO "Producto";
CREATE UNIQUE INDEX "Producto_codigoBarras_key" ON "Producto"("codigoBarras");
CREATE INDEX "Producto_nombre_idx" ON "Producto"("nombre");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE UNIQUE INDEX "Proveedor_nombre_key" ON "Proveedor"("nombre");

