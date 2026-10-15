import type { CapacitorConfig } from "@capacitor/cli";

// Esta app siempre necesita el backend en vivo (inventario/ventas reales, no
// es una app que funcione offline por diseño), así que en vez de empacar el
// HTML/JS dentro del .apk, la app nativa carga directamente la URL pública
// donde quede desplegado el backend+frontend juntos (ver README, sección
// "Poner en producción → Opción B"). Cuando esa URL cambie, solo hay que
// actualizar `server.url` aquí abajo y volver a compilar — no hace falta
// tocar nada más.
//
// IMPORTANTE: reemplaza esta URL de ejemplo por la URL real una vez que el
// backend quede desplegado (Railway, Render, etc.).
const URL_PRODUCCION = process.env.SANMIGUEL_APP_URL || "https://CAMBIAR-POR-TU-URL-DE-RAILWAY.up.railway.app";

const config: CapacitorConfig = {
  appId: "com.surtidesechables.sanmiguel",
  appName: "San Miguel Arcángel",
  webDir: "dist",
  server: {
    url: URL_PRODUCCION,
    cleartext: false,
  },
  android: {
    backgroundColor: "#101f38",
  },
};

export default config;
