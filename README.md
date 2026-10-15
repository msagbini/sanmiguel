# San Miguel — Inventario, punto de venta y facturación

App web para **Surtidesechables San Miguel Arcángel** (Cra 43 con Calle 8,
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
  de la venta (en $ y %) y la resalta en rojo si el margen es bajo. Con un
  margen bruto típico de ~10%, los descuentos rápidos se quedan cortos a
  propósito (1/2/3%) y el tope para cajeros por defecto es 3% — más que eso
  hay que escribirlo a mano y lo debe autorizar un administrador; el backend
  lo hace cumplir, no es solo un aviso visual. Si aun así una venta queda
  por debajo del costo (con descuento o precio editado a mano), aparece una
  confirmación explícita antes de cobrar — para nadie, ni el administrador,
  vende con pérdida sin darse cuenta.
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

## Correr la app en tu laptop (paso a paso, para probarla ya)

Esto es para verla y probarla en tu propio computador, sin depender de este
entorno. Toma unos 10 minutos la primera vez.

**1. Instala Node.js** (si no lo tienes ya): entra a
[nodejs.org](https://nodejs.org) y descarga la versión **LTS** (la
recomendada, actualmente 20 o superior). Instálala como cualquier programa
(siguiente, siguiente, finalizar). Para confirmar que quedó instalada, abre
una terminal (en Windows: "cmd" o "PowerShell"; en Mac: "Terminal") y escribe:

```bash
node --version
```

Si te muestra un número (ej. `v20.x.x`) ya quedó lista.

**2. Descarga el proyecto.** Si tienes Git instalado:

```bash
git clone <URL-del-repositorio>
cd sanmiguel
git checkout claude/san-miguel-inventory-app-m0mfle
```

Si no tienes Git, descarga el proyecto como ZIP desde GitHub (botón verde
"Code" → "Download ZIP", asegurándote de estar parado en la rama
`claude/san-miguel-inventory-app-m0mfle`) y descomprímelo en una carpeta.

**3. Prende el backend** (la parte que guarda los datos). Abre una terminal
**dentro de la carpeta del proyecto** y escribe, una línea a la vez:

```bash
cd server
npm install
cp .env.example .env
npx prisma migrate deploy
npm run seed
npm run dev
```

`npm install` descarga las piezas que necesita el programa (tarda un poco la
primera vez, es normal). `npm run seed` crea el usuario administrador y unos
productos de ejemplo. Al final debe quedar mostrando en la terminal:
`San Miguel API escuchando en http://localhost:4000` — **deja esa terminal
abierta y corriendo**, no la cierres.

**4. Prende el frontend** (lo que ves en pantalla). Abre una **segunda
terminal** (deja la primera corriendo) y escribe:

```bash
cd web
npm install
npm run dev
```

Al final va a mostrar algo como `Local: http://localhost:5173/`. Abre esa
dirección en tu navegador (Chrome, funciona mejor).

**5. Entra con el usuario administrador:**

- **Email:** `sagbini1807@gmail.com`
- **Contraseña temporal:** `SanMiguel2026`

Cámbiala apenas entres, desde Configuración → Usuarios — es una contraseña
que quedó escrita en este mismo documento, así que no debe seguir siendo la
definitiva.

**Para volver a abrirla otro día:** no hay que repetir todo, solo los pasos
3 y 4 desde `npm run dev` (sáltate `npm install`, `migrate deploy` y `seed`,
esos son de una sola vez). Es decir: una terminal con `cd server && npm run
dev`, otra con `cd web && npm run dev`, y entrar a `http://localhost:5173`.

**Nota de seguridad:** el archivo `server/.env` trae un `JWT_SECRET` de
ejemplo. Para probar en tu laptop está bien, pero si algún día esto corre en
un computador con el que otras personas puedan conectarse por red/internet,
cámbialo por uno propio largo y aleatorio antes de usarlo en serio (ver
"Seguridad" más abajo).

## Poner en producción

Hay dos formas de tenerla corriendo de verdad, no solo para probar en tu laptop:

### Opción A — el PC del mostrador (sin depender de internet)

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

### Opción B — un servicio en la nube (Railway, Render, etc.), accesible desde cualquier celular sin prender la laptop

El proyecto trae un `package.json` en la raíz pensado exactamente para esto:
el backend, una vez construido, sirve también el frontend ya compilado
(`web/dist`) desde el mismo proceso y el mismo puerto — un solo servicio, una
sola URL, sin configurar CORS entre dos dominios distintos.

- **Build command**: `npm run build` (en la raíz del repo — instala y
  compila `server/` y `web/` en un solo paso).
- **Start command**: `npm start` (en la raíz — aplica las migraciones
  pendientes y arranca el servidor, que ya sirve la app completa).
- **Root Directory** en el panel del proveedor: la raíz del repositorio, no
  `server/` ni `web/` por separado.
- **Variables de entorno obligatorias**: `JWT_SECRET` (largo y aleatorio,
  nunca el de ejemplo) y `NODE_ENV=production`. El puerto lo define
  automáticamente la plataforma (`PORT`), no hace falta configurarlo.
- **⚠️ Muy importante — la base de datos necesita un volumen persistente.**
  Esta app usa SQLite (un solo archivo). La mayoría de plataformas en la nube
  (incluida Railway) borran el disco del contenedor en cada despliegue nuevo
  a menos que se le adjunte explícitamente un **volumen persistente**. Si no
  se configura uno, cada vez que se vuelva a desplegar la app (o se reinicie
  el servicio) **se pierden todas las ventas, clientes e inventario**. Pasos:
  1. En el panel del proveedor, crea/adjunta un volumen y móntalo en una ruta
     que persista, por ejemplo `/data`.
  2. Define `DATABASE_URL="file:/data/dev.db?connection_limit=1"` (esa misma
     ruta del volumen) como variable de entorno.
  3. Con eso, las migraciones y los datos quedan guardados en el volumen y
     sobreviven a futuros despliegues.
- Una vez desplegado, la URL pública que te dé la plataforma funciona igual
  desde el navegador de cualquier celular, sin necesidad de estar en la
  misma red ni de tener la laptop prendida. Ahí también sirve "Agregar a
  pantalla de inicio" para instalarla como app.

### En cualquiera de las dos opciones

**Antes de dejarlo corriendo de verdad**, define en las variables de entorno
un `JWT_SECRET` propio, largo y aleatorio (no el de ejemplo), y
`NODE_ENV=production` — el servidor directamente se niega a arrancar en
producción si no lo hiciste, para que no quede protegido con un secreto que
cualquiera puede adivinar. Si el frontend se sirve desde un dominio o IP
distinto al backend (no aplica en la Opción B, donde comparten origen),
también hay que definir `CORS_ORIGIN` con esa URL exacta (ver "Seguridad"
más abajo) — si no, el navegador bloqueará las peticiones a la API.

## Seguridad

Esta app maneja plata, inventario y deudas de clientes reales, así que se
construyó pensando en que alguien podría intentar hackearla, robarle
mercancía o hacerle trampa al sistema — no solo en que funcione bien cuando
todo sale como se espera. Lo que ya está en pie:

- **Contraseñas nunca en texto plano**: se guardan con `bcrypt` (hash con
  sal), ni siquiera un administrador con acceso a la base de datos puede
  leerlas.
- **Sesión con JWT** con expiración (12 horas): cada acción de la API exige
  un token válido; los tokens vencidos o falsificados se rechazan.
- **Roles reales, no solo de interfaz**: ADMIN vs CAJERO se valida en el
  backend en cada endpoint sensible (anular ventas, aprobar estudios de
  crédito, cambiar configuración), no solo ocultando botones en pantalla —
  un cajero que intente llamar esas rutas directamente (sin pasar por la
  interfaz) recibe un 403.
- **Límite de intentos de login**: 10 intentos cada 15 minutos por IP: corta
  de raíz los ataques de fuerza bruta de contraseñas. El resto de la API
  también tiene un límite general (300 solicitudes/minuto) contra scripts
  abusivos.
- **CORS restringido**: solo el origen configurado (`localhost:5173` en
  desarrollo) puede llamar a la API desde un navegador; cualquier otro sitio
  queda bloqueado.
- **Cabeceras de seguridad HTTP** (`helmet`): protección básica contra
  ataques comunes de navegador (clickjacking, sniffing de tipo de contenido, etc.).
- **Nada de sobreventa ni de fiar de más, ni siquiera en carrera**: el
  descuento de stock, el consecutivo de la factura y el cargo al cupo de
  fiado usan operaciones atómicas a nivel de base de datos (no
  "leer-calcular-guardar"), así que dos ventas casi simultáneas — dos cajas,
  un doble clic, un intento deliberado de aprovechar el momento exacto —
  nunca pueden vender el mismo producto agotado dos veces, generar dos
  facturas con el mismo número, ni fiar por encima del cupo aprobado. Esto
  se probó a propósito con hasta 50 ventas disparadas en el mismo instante:
  cero duplicados, cero sobreventa.
- **El estudio de crédito no se puede saltar por atrás**: aunque alguien
  intente asignar cupo de fiado o aprobar un estudio incompleto llamando
  directamente a la API (sin pasar por la pantalla de Clientes), el backend
  vuelve a validar los mínimos (2 codeudores, 2 referencias, aprobación de
  un ADMIN) — la interfaz no es la única línea de defensa.
- **Body de solicitudes limitado** (1 MB) y validación estricta de tipos,
  rangos y tamaños de lista en cada endpoint (con `zod`): corta payloads
  gigantes o números absurdos (`Infinity`, listas de miles de ítems) antes
  de que lleguen a la lógica de negocio.
- **JWT_SECRET obligatorio en producción**: el servidor se niega a arrancar
  en producción si no se configuró un secreto propio y suficientemente
  largo, en vez de arrancar igual con un valor por defecto conocido.

Lo que queda como responsabilidad de quien lo opera (no algo que la app
pueda resolver sola): usar HTTPS si el negocio queda accesible desde
internet (no solo la red local), hacer respaldos periódicos de
`server/prisma/dev.db`, y no compartir la contraseña del usuario
administrador.

## App de Android (opcional)

Además de la PWA (instalable gratis desde el navegador, ver más abajo), el
proyecto trae listo un envoltorio nativo de Android hecho con
[Capacitor](https://capacitorjs.com) en `web/android/`. No es una
reescritura: es la misma app cargando la URL pública donde quede desplegado
el backend (ver "Poner en producción → Opción B"), pero empacada como una
app instalable de verdad, con su propio ícono y pantalla de carga (ya
diseñados con el escudo del arcángel).

**Por qué no viene ya compilada en un `.apk`:** generar el instalable final
necesita el Android SDK y descargar paquetes de `dl.google.com`, algo que
este entorno de desarrollo no puede hacer (la red donde corre Claude no
tiene salida a esa dirección). Compilarlo es el único paso que falta, y se
hace en una computadora normal con internet:

1. **Actualiza la URL del backend.** Abre `web/capacitor.config.ts` y
   cambia `URL_PRODUCCION` por la URL real donde quedó desplegado el backend
   (Railway, Render, etc. — ver la sección de despliegue arriba). Sin esto,
   la app no tiene de dónde cargar los datos.
2. **Instala [Android Studio](https://developer.android.com/studio)**
   (gratis). Al abrirlo por primera vez, te ofrece instalar el Android SDK
   automáticamente — acepta.
3. En una terminal, dentro de `web/`:
   ```bash
   npm install
   npm run build
   npx cap sync android
   npx cap open android
   ```
   Esto abre el proyecto en Android Studio.
4. Conecta un celular Android por USB (con "Depuración USB" activada en
   Opciones de desarrollador) y dale al botón ▶ Run — instala y abre la app
   directo en el celular. O, para generar un `.apk` que se pueda compartir e
   instalar en cualquier equipo sin cable: menú **Build → Generate Signed
   Bundle / APK**.
5. El `.apk` que genere queda en
   `web/android/app/build/outputs/apk/debug/app-debug.apk` (o `release/` si
   firmaste uno de release). Ese archivo se puede mandar por WhatsApp/USB e
   instalar en cualquier Android activando "Permitir instalar de fuentes
   desconocidas" cuando lo pida.

Si en algún momento cambia la URL del backend, hay que repetir los pasos 1 y
3 (`cap sync`) y volver a compilar — la app no se actualiza sola como sí lo
haría la PWA.

**¿Y en iPhone?** Técnicamente Capacitor también soporta iOS, pero
publicarla (o siquiera instalarla en un iPhone de prueba) requiere una Mac y
una cuenta de Apple Developer (99 USD/año) — no está configurado por ahora.
Para iPhone, la PWA (instalar desde Safari con "Agregar a inicio") sigue
siendo la mejor opción sin ese costo.

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

**Surtidesechables San Miguel Arcángel SÍ está obligado a facturar
electrónicamente ante la DIAN.** Esto ya no es una duda por resolver: es un
requisito legal vigente, así que activar el conector con un proveedor
tecnológico real (Factus u otro) no es opcional ni algo para "más adelante
si da tiempo" — es el paso pendiente de mayor urgencia legal de todo este
checklist, por encima de cualquier mejora de la app. Mientras el conector
real no esté activo, cada venta sigue emitiendo el documento equivalente POS
descrito arriba (que sirve para operar el día a día sin interrupciones),
pero eso **no sustituye la obligación de facturación electrónica** — es solo
lo que evita que el negocio se quede sin poder vender mientras se activa el
proveedor. Por eso, apenas se tengan NIT, certificado digital y resolución de
numeración vigente listos, hay que:
1. Crear la cuenta con el proveedor tecnológico (Factus u otro autorizado
   por la DIAN) y obtener las credenciales de API.
2. Cargarlas en Configuración → Facturación electrónica DIAN y activar el
   interruptor.
3. Confirmar con el contador del negocio la resolución de numeración vigente
   y los datos fiscales exactos que debe llevar cada factura — eso sí sigue
   siendo trabajo de un contador, no de la app — pero la pregunta de "si
   toca facturar electrónicamente" ya está resuelta: toca.

Un banner en Configuración (visible para ADMIN) recuerda esto mientras el
interruptor siga apagado, para que no se pierda de vista.

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

- **Nadie tiene cupo de fiado por defecto, ni siquiera un cliente nuevo.**
  Antes de poder ponerle un cupo mayor a $0 a un cliente, hay que completarle
  un **estudio de crédito** desde Clientes → Editar: mínimo **2 codeudores**
  (nombre, documento, teléfono) y **2 referencias** (personales o
  comerciales), y un administrador tiene que aprobarlo explícitamente ahí
  mismo. Solo después de esa aprobación se habilita el campo de cupo. Esto
  aplica tanto en la pantalla como si alguien intentara saltárselo llamando
  la API directamente — el backend vuelve a exigir los mismos mínimos.
  Además de esto, quedan pendientes como trabajo legal aparte (la app no lo
  gestiona): pagaré firmado y carta de instrucciones en físico, que se
  pueden anotar como nota en el mismo estudio de crédito.
- **Si se borra un codeudor o una referencia** y el cliente queda por debajo
  del mínimo, la aprobación se revoca sola y el cupo vuelve a $0
  automáticamente — no se puede debilitar un estudio ya aprobado sin que el
  sistema se dé cuenta.
- En **Clientes**, cada cliente identificado (no el "Consumidor Final"
  genérico) puede tener un **cupo de fiado** (una vez aprobado el estudio) y
  unos **días de plazo** para pagar.
- En el **POS**, al elegir "Fiado (crédito)" como forma de pago, la app pide
  que haya un cliente seleccionado, valida que tenga el estudio de crédito
  aprobado y que la venta no se pase de su cupo disponible, y si todo bien,
  la registra: el recibo sale marcado "QUEDA FIADO — PENDIENTE POR PAGAR" y
  la deuda del cliente sube.
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
  src/middleware/auth.ts      Autenticación JWT y control de roles
  src/middleware/rateLimit.ts Límite de intentos de login y de la API en general
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
