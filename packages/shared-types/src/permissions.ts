import type { SystemRole } from "./roles";

/**
 * Catalogo de permisos granulares. El codigo es el identificador estable usado por
 * `requirePermission(code)` en las rutas del backend y por el frontend para mostrar/ocultar UI.
 *
 * IMPORTANTE (regla de negocio del spec): "product.price.update", "product.cost.update",
 * "product.barcode.update" y "product.delete" NUNCA se asignan al rol CAJERO por defecto.
 */
export const PERMISSIONS = [
  { code: "product.create", module: "inventory", description: "Crear productos" },
  { code: "product.read", module: "inventory", description: "Ver productos" },
  { code: "product.update", module: "inventory", description: "Editar datos generales de un producto" },
  { code: "product.price.update", module: "inventory", description: "Modificar el precio de venta de un producto" },
  { code: "product.cost.update", module: "inventory", description: "Modificar el costo de un producto" },
  { code: "product.barcode.update", module: "inventory", description: "Modificar el codigo de barras de un producto" },
  { code: "product.delete", module: "inventory", description: "Eliminar productos" },
  { code: "category.manage", module: "inventory", description: "Administrar categorias" },
  { code: "brand.manage", module: "inventory", description: "Administrar marcas" },
  { code: "stock.entry.create", module: "inventory", description: "Registrar entradas de inventario" },
  { code: "stock.adjust", module: "inventory", description: "Ajustar inventario" },
  { code: "stock.transfer", module: "inventory", description: "Transferir inventario entre sucursales" },

  { code: "sale.create", module: "pos", description: "Registrar ventas" },
  { code: "sale.read", module: "pos", description: "Ver ventas" },
  { code: "sale.cancel", module: "pos", description: "Anular ventas" },
  { code: "discount.authorize", module: "pos", description: "Autorizar descuentos que exceden el limite de un cajero" },
  { code: "quote.create", module: "pos", description: "Crear cotizaciones" },
  { code: "creditnote.create", module: "pos", description: "Emitir notas credito" },
  { code: "debitnote.create", module: "pos", description: "Emitir notas debito" },

  { code: "customer.read", module: "customers", description: "Ver clientes" },
  { code: "customer.manage", module: "customers", description: "Crear/editar clientes" },

  { code: "cash.session.open", module: "cash", description: "Abrir caja" },
  { code: "cash.session.close", module: "cash", description: "Cerrar caja (arqueo)" },
  { code: "cash.movement.create", module: "cash", description: "Registrar ingresos/egresos de caja" },

  { code: "rbac.manage", module: "rbac", description: "Administrar roles, usuarios y permisos" },
  { code: "audit.read", module: "audit", description: "Consultar el log de auditoria" },
  { code: "dashboard.read", module: "dashboard", description: "Ver el dashboard" },
] as const;

export type PermissionCode = (typeof PERMISSIONS)[number]["code"];

/** Permisos por defecto de cada rol de sistema. Se siembran en `packages/database/prisma/seed.ts`. */
export const DEFAULT_ROLE_PERMISSIONS: Record<SystemRole, PermissionCode[]> = {
  ADMINISTRADOR: PERMISSIONS.map((p) => p.code),
  PROPIETARIO: PERMISSIONS.map((p) => p.code),
  CONTADOR: [
    "product.read",
    "sale.read",
    "audit.read",
    "dashboard.read",
  ],
  SUPERVISOR: [
    "product.create",
    "product.read",
    "product.update",
    "product.price.update",
    "product.cost.update",
    "product.barcode.update",
    "category.manage",
    "brand.manage",
    "stock.entry.create",
    "stock.adjust",
    "stock.transfer",
    "sale.create",
    "sale.read",
    "sale.cancel",
    "discount.authorize",
    "quote.create",
    "creditnote.create",
    "debitnote.create",
    "customer.read",
    "customer.manage",
    "cash.session.open",
    "cash.session.close",
    "cash.movement.create",
    "audit.read",
    "dashboard.read",
  ],
  CAJERO: [
    // Explicitamente SIN product.price.update / product.cost.update / product.barcode.update / product.delete
    "product.read",
    "sale.create",
    "sale.read",
    "quote.create",
    "customer.read",
    "customer.manage",
    "cash.session.open",
    "cash.session.close",
    "cash.movement.create",
    "dashboard.read",
  ],
  EMPLEADO: ["dashboard.read"],
};
