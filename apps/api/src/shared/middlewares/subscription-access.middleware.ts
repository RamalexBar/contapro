import type { NextFunction, Request, Response } from "express";

/** Lo que el middleware necesita saber de la suscripcion de una empresa (ver GetSubscriptionAccessUseCase). */
export interface SubscriptionWriteBlock {
  /** Cajapro cobra el combo: el cliente renueva alla, no en Contapro. */
  billedByCajapro: boolean;
}

type Checker = (companyId: string) => Promise<SubscriptionWriteBlock | null>;

let checker: Checker | null = null;

/** El modulo billing registra aqui como saber si una empresa esta en solo lectura (shared no
 * depende de ningun modulo: billing.container.ts se lo inyecta al arrancar). */
export function registerSubscriptionAccessChecker(fn: Checker) {
  checker = fn;
}

const SAFE_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);
// Lo que una empresa suspendida si puede hacer: pagar su plan y entrar/salir/cambiar de sucursal.
const EXEMPT_PREFIXES = ["/api/subscription", "/api/auth/"];

/**
 * Solo lectura para las empresas con la suscripcion SUSPENDED o CANCELLED: pueden entrar,
 * consultar todo y pagar, pero nada que registre o cambie informacion (402). Igual que el
 * `read_only` de Cajapro. La llaman tenantContextMiddleware (usuarios) y apiKeyAuthMiddleware
 * (integraciones, incluida la conexion de Cajapro), ya dentro del contexto del tenant.
 *
 * Cada router tenant-scoped vuelve a pasar por tenantContextMiddleware: `res.locals` evita repetir
 * la consulta en la misma request. Si la consulta falla se deja pasar (no se tumba el sistema
 * entero por un error leyendo la suscripcion).
 */
export async function enforceSubscriptionWriteAccess(req: Request, res: Response, companyId: string, next: NextFunction) {
  if (SAFE_METHODS.has(req.method) || res.locals.subscriptionWriteChecked || !checker) return next();
  if (EXEMPT_PREFIXES.some((p) => req.originalUrl.startsWith(p))) return next();

  let block: SubscriptionWriteBlock | null = null;
  try {
    block = await checker(companyId);
  } catch (err) {
    console.error("[subscription-access] no se pudo leer la suscripcion", companyId, err);
  }
  if (block) {
    return res.status(402).json({
      error: "SUBSCRIPTION_SUSPENDED",
      message: block.billedByCajapro
        ? "Su plan de Contapro está suspendido porque el combo no se renovó en Cajapro. Puede consultar su información; para registrar o cambiar algo, renueve el plan «Anual con Contapro» en Cajapro."
        : "Su suscripción está suspendida. Puede consultar su información; para registrar o cambiar algo, pague su plan en Mi suscripción.",
    });
  }
  res.locals.subscriptionWriteChecked = true;
  next();
}
