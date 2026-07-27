import { AsyncLocalStorage } from "node:async_hooks";

export interface TenantContext {
  companyId: string;
  branchId: string | null;
  userId: string;
  roles: string[];
  permissions: Set<string>;
  ipAddress?: string;
  userAgent?: string;
}

export const tenantStorage = new AsyncLocalStorage<TenantContext>();

/**
 * Recupera el contexto de la request actual (empresa/sucursal/usuario/permisos).
 * Lanza si se invoca fuera de una request autenticada: cualquier caso de uso o repositorio
 * que dependa de esto DEBE ejecutarse detras de `tenantContextMiddleware`.
 */
export function getTenantContext(): TenantContext {
  const ctx = tenantStorage.getStore();
  if (!ctx) {
    throw new Error("TenantContext no disponible fuera de una request autenticada");
  }
  return ctx;
}

export function hasPermission(code: string): boolean {
  return getTenantContext().permissions.has(code);
}
