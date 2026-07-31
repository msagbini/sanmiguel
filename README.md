# San Miguel — Inventario, punto de venta y facturación

App web para la salsamentaria/distribuidora San Miguel (Cra 43 con Calle 8,
Mercado de Barranquilla): control de inventario, punto de venta con lectura
de código de barras y facturación electrónica DIAN.

El nombre y la identidad visual (azul celestial + oro) están inspirados en
San Miguel Arcángel: el protector, el que pelea con orden y con las cuentas
claras — de ahí también el énfasis en cartera controlada y arqueo de caja,
no solo en vender.

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
  mixto, fiado), impresión de recibo (formato 58mm u 80mm para impresora
  térmica).
- **Precio mayorista y ventas al detal**: cada producto puede tener un
  precio normal y un precio mayorista para tenderos que revenden. Al marcar
  un cliente como "Mayorista" en el POS, sus precios se ajustan solos. El
  precio de cada línea del carrito también se puede editar a mano (para un
  precio negociado puntual), y se puede agregar un "producto libre" (algo
  que no está en el catálogo, ej. un servicio o un artículo ocasional) sin
  afectar el inventario.
- **Protección de margen**: el carrito muestra en vivo la ganancia estimada
  de la venta (en $ y %) y la resalta en rojo si el margen es bajo. Los
  descuentos rápidos (1/2/3/5/10% + un valor libre) tienen un tope
  configurable para cajeros (por defecto 5%) — pasarse de ese tope requiere
  que un administrador aplique el descuento; el backend lo hace cumplir, no
  es solo un aviso visual.
- **Cartera / fiado**: cada cliente puede tener un cupo de crédito y un
  plazo de pago. Una venta "fiada" no se cobra de inmediato: queda cargada a
  la cuenta del cliente. La pantalla de Cartera muestra cuánto debe cada
  cliente, quién está vencido (según el plazo configurado), permite
  registrar abonos (pagos parciales o totales) y genera un link de WhatsApp
  con el saldo pendiente listo para enviar como recordatorio. Todo queda en
  un historial auditable (quién fio, quién recibió el abono, cuándo).
- **Vencimientos**: al recibir mercancía se le puede poner fecha de
  vencimiento (queda como un "lote"). El inventario descuenta primero lo más
  próximo a vencer (FEFO), Inventario avisa qué está por vencer o ya venció,
  y desde ahí mismo se puede "dar de baja" un lote dañado/vencido (genera la
  salida de inventario sola).
- **Recepción de mercancía**: pantalla dedicada para cuando llega el pedido
  del proveedor — se escanea cada producto y se le suma la cantidad
  recibida sin salir de esa pantalla; si el producto no existe todavía, se
  crea al vuelo con el código ya escaneado (código de barras o carga
  manual, lo que sea más rápido en el momento).
- **Cobro con datáfono**: al elegir "Tarjeta", aparece una pantalla de cobro
  con el monto en letra gigante para digitarlo en cualquier datáfono físico
  (funciona con cualquier marca, sin configurar nada). Si más adelante
  contratan un datáfono con API propia, hay un conector de referencia
  (`server/src/services/terminal.ts`) para enviarle el cobro automáticamente.
- **Turno de caja (arqueo)**: se abre el turno con una base en efectivo y se
  cierra contando el efectivo físico; la app calcula lo esperado (base +
  ventas en efectivo + abonos de fiado en efectivo) y muestra la diferencia,
  para detectar faltantes sin depender de la memoria de quién vendió qué.
- **Reportes**: ventas por día, productos más vendidos, ganancia estimada,
  ticket promedio, exportables a CSV (Excel) desde Ventas, Productos y
  Reportes.
- **Catálogo inteligente en el POS**: se ordena solo por lo más vendido en
  los últimos 30 días, para que lo que más rota quede primero. Atajos de
  teclado (F2 escanear, F9 cobrar, Esc cancelar) y un pitido de
  confirmación al escanear, como una caja registradora de verdad.
- **Campana de alertas**: junta en un solo lugar stock bajo, vencimientos
  próximos y cartera vencida, con acceso directo a cada pantalla.
- **Usuarios y roles**: Administrador (todo, incluye anular ventas y
  autorizar descuentos/fiados grandes) y Cajero (POS, ver ventas, cartera y
  clientes, con topes de descuento), para que cualquier persona pueda
  cobrar sin tocar precios base ni inventario.
- **PWA**: se puede "instalar" en una tablet o PC desde el navegador
  (ícono en el escritorio, pantalla completa).
- **Pensada para otros negocios similares**: nada en el modelo de datos
  depende de que sea una salsamentaria — categorías, unidades, precio
  mayorista, fiado y roles sirven igual para un minimercado, una tienda de
  ropa/calzado, una ferretería, etc. (hay un campo "Tipo de negocio" en
  Configuración, hoy solo informativo). Ver "Roadmap" al final para lo que
  falta para ese salto (variantes de talla/color, múltiples sucursales).

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

## Fiado y cartera — cómo funciona

El problema real que resuelve: cuando le fían a alguien, esa plata deja de
verse como "efectivo en caja" pero sigue contando como venta — y si no se
lleva un registro aparte, es imposible saber cuánto le deben al negocio en
total y quién no ha pagado.

- En **Clientes**, cada cliente identificado (no el "Consumidor Final"
  genérico) puede tener un **cupo de fiado** (0 = no se le fía nada) y unos
  **días de plazo** para pagar.
- En el **POS**, al elegir "Fiado (crédito)" como forma de pago, la app pide
  que haya un cliente seleccionado, valida que la venta no se pase de su
  cupo disponible, y si todo bien, la registra: el recibo sale marcado
  "QUEDA FIADO — PENDIENTE POR PAGAR" y la deuda del cliente sube.
- En **Cartera**, se ve cuánto debe cada cliente, hace cuántos días está
  vencida esa deuda (según su plazo configurado) y el total general por
  cobrar / vencido. Desde ahí se registra un **abono** (pago total o
  parcial) y se puede mandar un recordatorio por WhatsApp con un clic (abre
  WhatsApp Web/App con el mensaje ya escrito — no envía nada automático ni
  requiere contratar la API de WhatsApp Business).
- Si se anula una venta fiada, la deuda se revierte sola.
- Todo movimiento (cada venta fiada, cada abono) queda en un historial con
  fecha y quién lo hizo, para poder auditar "¿quién le fio esto a fulano?".
- **Si deciden dejar de fiar del todo**, en Configuración hay un interruptor
  maestro "Habilitar fiado": al apagarlo, "Fiado" desaparece como forma de
  pago en el POS (nadie puede fiar una venta nueva), pero las deudas que ya
  existen se pueden seguir cobrando y viendo en Cartera con toda
  normalidad. No hay que perder el historial para poner freno a que se siga
  fiando.

Esto no reemplaza la disciplina de cobrar — pero al menos ahora hay un
número exacto de cuánto se está fiando y a quién (con cupos que ponen un
límite duro), en vez de depender de una libreta o de la memoria.

## Vencimientos (productos perecederos)

Pensado para lo que se vence de verdad (embutidos, lácteos, algunos
desechables con vida útil): al recibir mercancía (Productos → Ajustar stock
→ Entrada, o desde Recepción de mercancía) se puede poner la fecha de
vencimiento de ese lote. La app:

- Descuenta inventario con **FEFO** (First-Expired-First-Out): al vender o
  registrar una salida, se consume primero el lote que vence más pronto.
- En **Inventario** aparece qué está por vencer (con los días de
  anticipación que se configuren) y qué ya venció, con cantidad y producto.
- Desde ahí mismo se puede **dar de baja** un lote (vencido, dañado): genera
  la salida de inventario correspondiente y descuenta el stock, con el
  motivo que se escriba quedando en el historial.
- Un producto que nunca recibe fecha de vencimiento simplemente no entra a
  este seguimiento — no es obligatorio, solo está disponible para lo que sí
  se vence.

## Recepción de mercancía

Desde Productos → "Recepción de mercancía": pantalla pensada para cuando
llega el pedido del proveedor. Se escanea cada producto uno tras otro y se
le suma la cantidad recibida (con costo y fecha de vencimiento si aplica)
sin salir de esa pantalla. Si algo no existe todavía en el catálogo, se
crea ahí mismo con el código ya escaneado — o se puede escribir a mano si no
tiene código de barras. Al final queda un resumen de todo lo recibido en esa
sesión.

## Cobro con datáfono

La solución que funciona hoy mismo, sin contratar nada ni configurar nada:
al elegir "Tarjeta" como forma de pago, aparece una **pantalla de cobro**
con el monto exacto en letra gigante, para que el cajero lo digite (o el
cliente lo verifique) en cualquier datáfono físico de cualquier banco o
proveedor. Reduce el error de digitar mal el monto, que es el problema real
del día a día.

Para "empujar" el cobro automáticamente al datáfono (que se active solo,
sin digitar nada) hace falta un datáfono con API propia — cada marca (Bold,
RappiPay POS, Movii, addi, datáfonos de bancos) tiene la suya y requiere una
cuenta de comercio habilitada con esa marca. Se dejó un conector de
referencia para **Bold** (`server/src/services/terminal.ts`) siguiendo su
contrato público de API; se activa en Configuración → Datáfono con sus
credenciales. Igual que con la facturación electrónica, si el envío
automático falla, la venta no se bloquea: el cajero cobra manualmente con
la pantalla de cobro y ya.

## Turno de caja (arqueo)

Con dos empleados y la mamá entrando de vez en cuando, es fácil perder la
cuenta de cuánto debería haber en caja. Por eso hay un turno de caja
opcional (no bloquea las ventas si no se abre uno):

- **Abrir caja** con una base en efectivo (fondo inicial).
- Mientras el turno está abierto, cada venta y cada abono de fiado quedan
  asociados a ese turno.
- **Cerrar caja** contando el efectivo físico: la app calcula lo esperado
  (fondo + ventas en efectivo + abonos de fiado recibidos en efectivo
  durante el turno) y muestra la diferencia contra lo contado. Los pagos con
  tarjeta, transferencia o fiado no entran en este cálculo porque no son
  efectivo en el cajón.
- Solo puede haber un turno abierto a la vez (pensado para una sola caja);
  lo puede cerrar quien lo abrió o un administrador.

## Estructura de carpetas

```
server/
  prisma/schema.prisma        Modelo de datos
  prisma/seed.ts              Datos iniciales (admin, categorías, productos demo)
  src/routes/                 Endpoints (productos, ventas, clientes, reportes, lotes, turnos, pagos...)
  src/services/invoicing.ts   Conector de facturación electrónica DIAN
  src/services/terminal.ts    Conector de datáfono
  src/services/lotes.ts       Consumo FEFO de lotes con vencimiento
web/
  src/pages/                       Pantallas (POS, Productos, Ventas, Cartera, Inventario, Reportes...)
  src/hooks/useBarcodeScanner.ts   Captura del lector de código de barras
  src/components/Recibo.tsx        Recibo/factura imprimible
  src/components/PantallaCobro.tsx      Pantalla de cobro con datáfono
  src/components/RecepcionMercancia.tsx Recepción de mercancía (escaneo + manual)
  src/components/TurnoWidget.tsx        Apertura/cierre de caja
  src/components/AlertBell.tsx          Campana de alertas (stock, vencimientos, cartera)
```

## Roadmap (para crecer a otros negocios / más de un PC)

Lo que ya está construido sirve tal cual para cualquier tienda de barrio,
minimercado o negocio con mostrador. Si el siguiente paso es venderla a
otro tipo de negocio o crecer más allá de un solo computador, esto es lo
que seguiría:

- **Variantes de producto** (talla, color, presentación): útil para ropa y
  calzado. Hoy cada producto es una sola referencia con un solo precio/stock;
  una tienda de ropa necesitaría una tabla de variantes por producto.
- **Multi-sucursal / multi-caja**: la arquitectura ya es cliente-servidor
  (el backend puede correr en un PC o servidor y varias cajas/tablets
  conectarse por la red local a la misma base de datos), pero para varias
  *sucursales* independientes con su propio inventario habría que agregar
  el concepto de "sede" al modelo de datos.
- **Backups automáticos**: hoy la base de datos es un archivo SQLite; para
  producción seria vale la pena programar una copia automática diaria (a un
  USB, a la nube, etc.) — no soportar la pérdida de ese único archivo.
- **Notificaciones automáticas de cartera vencida** (hoy el recordatorio de
  WhatsApp es manual, con un clic).
