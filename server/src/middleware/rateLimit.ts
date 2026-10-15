import rateLimit from "express-rate-limit";

// El login es el blanco más obvio para un ataque de fuerza bruta de
// contraseñas: se limita agresivamente por IP, mucho más que el resto de la API.
export const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Demasiados intentos de inicio de sesión. Espera unos minutos e inténtalo de nuevo." },
});

// Límite general para el resto de la API: generoso para el uso normal de un
// punto de venta (varias ventas por minuto), pero corta scripts que
// intenten agotar recursos o hacer scraping del catálogo/clientes.
export const apiLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 300,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Demasiadas solicitudes. Espera un momento e inténtalo de nuevo." },
});
