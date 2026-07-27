import rateLimit from "express-rate-limit";

/** Limita intentos de login/refresh para mitigar fuerza bruta (se audita ademas en AuditLog). */
export const authRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "TOO_MANY_REQUESTS", message: "Demasiados intentos, intenta mas tarde" },
});

/** Limite general para el resto de la API. */
export const apiRateLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 300,
  standardHeaders: true,
  legacyHeaders: false,
});
