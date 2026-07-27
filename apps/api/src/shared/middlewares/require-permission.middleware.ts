import type { NextFunction, Request, Response } from "express";
import { getTenantContext } from "../context/request-context";
import { ForbiddenError } from "../errors/app-error";

/**
 * Exige que el usuario autenticado tenga el permiso indicado (union de permisos por rol +
 * overrides individuales en UserPermission, ya resueltos al momento del login/refresh y
 * embebidos en el JWT). Por ejemplo, un Cajero NUNCA tiene "product.price.update" por defecto.
 */
export function requirePermission(code: string) {
  return (_req: Request, _res: Response, next: NextFunction) => {
    const ctx = getTenantContext();
    if (!ctx.permissions.has(code)) {
      return next(new ForbiddenError(`Requiere el permiso: ${code}`));
    }
    next();
  };
}
