# San Miguel — Inventario, punto de venta y facturación

App web para la salsamentaria/distribuidora San Miguel (Cra 43 con Calle 8,
Mercado de Barranquilla): control de inventario, punto de venta con lectura
de código de barras y facturación electrónica DIAN.

## ¿Qué incluye?

- **Inventario**: productos con código de barras, categorías (Desechables,
  Icopor, Porta comidas, Dulces, Papas y snacks, Bebidas, Aseo, Papelería,
  Varios), unidades de venta (unidad, paquete, caja, kg, g, libra, litro),
  IVA por producto (0%, 5%, 19%), alertas de stock mínimo, historial de
  movimientos (entradas, salidas/mermas, ajustes por conteo físico,
  devoluciones).
- **Punto de venta (POS)**: pensado para usarse con una pistola lectora de
  código de barras USB (funciona como teclado: no necesita drivers, solo
  mantener el foco en el campo de escaneo), carrito, catálogo con filtro por
  categoría para productos sin código de barras, clientes, formas de pago
  (efectivo con cálculo de cambio, tarjeta, transferencia/Nequi/Daviplata,
  mixto), impresión de recibo (formato 58mm u 80mm para impresora térmica).
- **Facturación electrónica DIAN**: por defecto la venta se emite como
  *documento equivalente POS* (comprobante válido para el día a día). Si se
  activa en Configuración con las credenciales de un proveedor tecnológico
  autorizado por la DIAN, la venta se factura electrónicamente de forma
  automática (ver sección de facturación electrónica más abajo).
- **Reportes**: ventas por día, productos más vendidos, ganancia estimada,
  ticket promedio.
- **Usuarios y roles**: Administrador (todo) y Cajero (solo POS y ver
  ventas), para que cualquier persona pueda cobrar sin tocar precios ni
  inventario.
- **PWA**: se puede "instalar" en una tablet o PC desde el navegador
  (ícono en el escritorio, pantalla completa).

## Arquitectura

```
server/   API en Node.js + Express + TypeScript + Prisma (SQLite)
web/      App en React + Vite + TypeScript + Tailwind CSS (PWA)
```

Es una arquitectura simple a propósito: todo corre en un solo computador o
en un servidor pequeño, con una base de datos SQLite (un solo archivo, fácil
de respaldar copiando `server/prisma/dev.db`).

## Poner en marcha (desarrollo)

Requisitos: Node.js 20+.

```bash
# Backend
cd server
npm install
cp .env.example .env      # revisa/edita las variables si hace falta
npx prisma migrate deploy # crea la base de datos
npm run seed              # usuario admin + categorías + productos de ejemplo
npm run dev                # http://localhost:4000

# Frontend (en otra terminal)
cd web
npm install
npm run dev                # http://localhost:5173 (ya tiene proxy a la API)
```

Usuario administrador inicial (creado por el seed):

- **Email:** `sagbini1807@gmail.com`
- **Contraseña temporal:** `SanMiguel2026`

Cámbiala apenas entres, desde Configuración → Usuarios.

## Poner en producción (el PC del mostrador o un servidor)

1. `cd server && npm install && npm run build && npx prisma migrate deploy && npm run seed`
   luego `npm start` (o mejor, con `pm2 start dist/index.js --name sanmiguel-api`
   para que se reinicie solo si el computador se reinicia).
2. `cd web && npm install && npm run build` y sirve la carpeta `web/dist` con
   cualquier servidor de archivos estáticos (nginx, `serve -s dist`, etc.),
   configurando que las rutas que empiecen en `/api` se redirijan (proxy) al
   backend en el puerto 4000.
3. Desde la tablet o PC del mostrador, entra a la URL del negocio y usa
   "Agregar a pantalla de inicio" / "Instalar app" del navegador para tenerla
   como una app normal.

## Lector de código de barras

Cualquier pistola lectora USB sirve — se comportan como un teclado que
escribe muy rápido y termina con Enter. En la pantalla de Punto de Venta hay
un campo que mantiene el foco automáticamente: solo escanea y el producto se
agrega al carrito. Si un producto no tiene código de barras (por ejemplo,
algo que se vende suelto), se puede buscar por nombre o tocar su tarjeta en
el catálogo.

Cuando des de alta un producto nuevo, puedes escanear el código directamente
en el campo "Código de barras" del formulario.

## Facturación electrónica DIAN — qué es real y qué falta

Construir la facturación electrónica 100% desde cero (firma digital XAdES,
XML UBL 2.1, y el proceso de habilitación/certificación ante la DIAN) es un
trámite legal aparte que toma semanas y requiere que el negocio ya tenga NIT,
certificado digital y una resolución de numeración vigente. Por eso esta app
sigue el camino que usa la gran mayoría de tiendas pequeñas en Colombia:

- **Hoy, por defecto**: cada venta genera un *documento equivalente POS*
  (Resolución DIAN 000165 de 2023): un comprobante de venta real y funcional
  para el día a día, que no requiere ni sustituye la factura electrónica.
- **Cuando el negocio esté listo**: en Configuración → Facturación
  electrónica DIAN, se puede activar el conector con un proveedor
  tecnológico autorizado por la DIAN. Ya está integrado un conector de
  referencia para **Factus** (`server/src/services/invoicing.ts`), uno de
  los proveedores con API más simple de Colombia. Basta con:
  1. Crear una cuenta con el proveedor elegido y obtener sus credenciales
     de API.
  2. Pegarlas en Configuración (URL de la API, API Key/Client ID y Client
     Secret) y activar el interruptor.
  3. Desde ese momento, cada venta se factura electrónicamente de forma
     automática (CUFE y QR quedan guardados en la venta y se imprimen en el
     recibo).
- **Si en algún momento cambian de proveedor** (o quieren usar otro
  distinto a Factus), solo hay que escribir una clase que implemente la
  interfaz `InvoicingProvider` en ese mismo archivo — el resto de la app no
  cambia.
- **Nunca se bloquea una venta por un problema de facturación**: si el
  proveedor falla (sin internet, credenciales vencidas, etc.), la venta
  queda guardada igual como documento POS y se puede reintentar la
  facturación después desde Ventas → Ver → "Reintentar facturación
  electrónica DIAN".

Antes de activarlo de verdad con el proveedor real, vale la pena confirmar
con un contador si el negocio ya está obligado a facturar electrónicamente
(depende de si son responsables de IVA, ingresos anuales, régimen tributario,
etc.) — la app no reemplaza ese consejo.

## Precios e IVA

Los precios de venta se ingresan **con IVA incluido** (así se muestran al
consumidor final en Colombia). La app calcula internamente la base gravable
y el IVA para el recibo y los reportes, según la tasa configurada por
producto (0% para excluidos/exentos, 5% o 19%).

## Estructura de carpetas

```
server/
  prisma/schema.prisma   Modelo de datos
  prisma/seed.ts         Datos iniciales (admin, categorías, productos demo)
  src/routes/            Endpoints (productos, ventas, clientes, reportes...)
  src/services/invoicing.ts   Conector de facturación electrónica DIAN
web/
  src/pages/             Pantallas (POS, Productos, Ventas, Reportes...)
  src/hooks/useBarcodeScanner.ts  Captura del lector de código de barras
  src/components/Recibo.tsx       Recibo/factura imprimible
```
