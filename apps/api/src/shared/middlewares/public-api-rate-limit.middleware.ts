import rateLimit from "express-rate-limit";

/**
 * Limite para la API publica (item 40 de docs/ALCANCE.md), separado del `apiRateLimiter` global.
 * `keyGenerator` usa el header Authorization (la API key) en vez de la IP -- mas adecuado para
 * trafico servidor-a-servidor que puede venir detras de un NAT/proxy compartido, donde limitar
 * por IP penalizaria a todos los clientes de ese proxy por igual.
 */
export const publicApiRateLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 120,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => req.headers.authorization ?? req.ip ?? "unknown",
  message: { error: "TOO_MANY_REQUESTS", message: "Demasiadas solicitudes, intenta mas tarde" },
});
