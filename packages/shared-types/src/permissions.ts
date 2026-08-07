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
  { code: "price-list.manage", module: "inventory", description: "Crear listas de precios y fijar precios por producto" },
  { code: "price-list.read", module: "inventory", description: "Ver listas de precios y sus precios por producto" },

  { code: "sale.create", module: "pos", description: "Registrar ventas" },
  { code: "sale.read", module: "pos", description: "Ver ventas" },
  { code: "sale.cancel", module: "pos", description: "Anular ventas" },
  { code: "discount.authorize", module: "pos", description: "Autorizar descuentos que exceden el limite de un cajero" },
  { code: "quote.create", module: "pos", description: "Crear cotizaciones" },
  { code: "creditnote.create", module: "pos", description: "Emitir notas credito" },
  { code: "debitnote.create", module: "pos", description: "Emitir notas debito" },
  { code: "return.create", module: "pos", description: "Registrar devoluciones de venta" },

  { code: "customer.read", module: "customers", description: "Ver clientes" },
  { code: "customer.manage", module: "customers", description: "Crear/editar clientes" },

  { code: "cash.session.open", module: "cash", description: "Abrir caja" },
  { code: "cash.session.close", module: "cash", description: "Cerrar caja (arqueo)" },
  { code: "cash.movement.create", module: "cash", description: "Registrar ingresos/egresos de caja" },

  { code: "rbac.manage", module: "rbac", description: "Administrar roles, usuarios y permisos" },
  { code: "audit.read", module: "audit", description: "Consultar el log de auditoria" },
  { code: "dashboard.read", module: "dashboard", description: "Ver el dashboard" },

  { code: "employee.create", module: "employees", description: "Crear empleados" },
  { code: "employee.read", module: "employees", description: "Ver empleados" },
  { code: "employee.update", module: "employees", description: "Editar datos de empleados" },
  { code: "employee.deactivate", module: "employees", description: "Dar de baja empleados" },

  { code: "timetracking.clock", module: "timetracking", description: "Marcar su propia entrada/salida" },
  { code: "timetracking.manage", module: "timetracking", description: "Marcar/editar entrada-salida de otros empleados" },
  { code: "timetracking.read", module: "timetracking", description: "Consultar registros de horarios" },

  { code: "timeoff.request", module: "timetracking", description: "Solicitar vacaciones/permisos/incapacidades propias" },
  { code: "timeoff.manage", module: "timetracking", description: "Aprobar/rechazar solicitudes y registrar ausencias de cualquier empleado" },
  { code: "timeoff.read", module: "timetracking", description: "Consultar vacaciones, permisos, ausencias e incapacidades" },

  { code: "payroll.parameter.manage", module: "payroll", description: "Administrar parametros legales de nomina por año" },
  { code: "payroll.create", module: "payroll", description: "Crear periodos de nomina" },
  { code: "payroll.read", module: "payroll", description: "Ver periodos y detalle de nomina" },
  { code: "payroll.calculate", module: "payroll", description: "Calcular/recalcular una nomina" },
  { code: "payroll.approve", module: "payroll", description: "Aprobar una nomina calculada" },
  { code: "payroll.pay", module: "payroll", description: "Marcar una nomina aprobada como pagada" },
  { code: "payroll.deduction.manage", module: "payroll", description: "Registrar y cancelar libranzas/embargos de un empleado" },

  { code: "accounting.manage", module: "accounting", description: "Administrar plan de cuentas y comprobantes contables" },
  { code: "accounting.read", module: "accounting", description: "Consultar plan de cuentas, comprobantes y reportes financieros" },

  { code: "suppliers.manage", module: "suppliers", description: "Crear proveedores y registrar compras" },
  { code: "suppliers.read", module: "suppliers", description: "Consultar proveedores y compras registradas" },

  { code: "expense.manage", module: "expenses", description: "Administrar categorias de gasto y registrar/cancelar gastos operativos" },
  { code: "expense.read", module: "expenses", description: "Consultar categorias y gastos operativos" },

  { code: "collection.manage", module: "collections", description: "Registrar abonos y generar links de pago sobre cuentas por cobrar" },
  { code: "collection.read", module: "collections", description: "Consultar cuentas por cobrar" },

  { code: "opportunity.manage", module: "crm", description: "Crear oportunidades, cambiar de etapa y cerrarlas" },
  { code: "opportunity.read", module: "crm", description: "Ver el pipeline de oportunidades" },

  { code: "electronic-invoicing.manage", module: "electronic-invoicing", description: "Administrar resoluciones de numeracion DIAN" },
  { code: "electronic-invoicing.read", module: "electronic-invoicing", description: "Consultar facturas electronicas generadas" },

  { code: "billing.manage", module: "billing", description: "Ver y pagar la suscripcion de la propia empresa" },

  { code: "recurring-invoice.manage", module: "recurring-invoicing", description: "Crear y editar plantillas de facturacion recurrente a clientes" },
  { code: "recurring-invoice.read", module: "recurring-invoicing", description: "Consultar plantillas de facturacion recurrente y su historial de ejecuciones" },

  { code: "commission.manage", module: "commissions", description: "Crear esquemas de comision, calcular y pagar liquidaciones a vendedores" },
  { code: "commission.read", module: "commissions", description: "Consultar esquemas de comision y liquidaciones" },

  { code: "fixed-asset.manage", module: "fixed-assets", description: "Registrar activos fijos, calcular y contabilizar su depreciacion" },
  { code: "fixed-asset.read", module: "fixed-assets", description: "Consultar activos fijos y su depreciacion" },

  // Sensibles a proposito (acceso programatico a los datos de la empresa): solo ADMINISTRADOR/
  // PROPIETARIO los reciben, mismo criterio restrictivo que rbac.manage -- no se agregan a
  // SUPERVISOR/CONTADOR/CAJERO.
  { code: "api-key.manage", module: "integrations", description: "Crear y revocar API keys para integraciones de terceros" },
  { code: "api-key.read", module: "integrations", description: "Consultar API keys existentes" },
  { code: "webhook.manage", module: "integrations", description: "Crear webhooks salientes y reenviar entregas fallidas" },
  { code: "webhook.read", module: "integrations", description: "Consultar webhooks salientes y su historial de entregas" },
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
    "employee.read",
    "timetracking.read",
    "timeoff.read",
    "payroll.parameter.manage",
    "payroll.create",
    "payroll.read",
    "payroll.calculate",
    "payroll.approve",
    "payroll.pay",
    "payroll.deduction.manage",
    "accounting.manage",
    "accounting.read",
    "suppliers.manage",
    "suppliers.read",
    "expense.manage",
    "expense.read",
    "collection.manage",
    "collection.read",
    "electronic-invoicing.manage",
    "electronic-invoicing.read",
    "billing.manage",
    "recurring-invoice.manage",
    "recurring-invoice.read",
    "commission.manage",
    "commission.read",
    "fixed-asset.manage",
    "fixed-asset.read",
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
    "price-list.manage",
    "price-list.read",
    "sale.create",
    "sale.read",
    "sale.cancel",
    "discount.authorize",
    "quote.create",
    "creditnote.create",
    "debitnote.create",
    "return.create",
    "customer.read",
    "customer.manage",
    "opportunity.manage",
    "opportunity.read",
    "cash.session.open",
    "cash.session.close",
    "cash.movement.create",
    "audit.read",
    "dashboard.read",
    "employee.create",
    "employee.read",
    "employee.update",
    "employee.deactivate",
    "timetracking.clock",
    "timetracking.manage",
    "timetracking.read",
    "timeoff.request",
    "timeoff.manage",
    "timeoff.read",
    "suppliers.manage",
    "suppliers.read",
    "expense.manage",
    "expense.read",
    "collection.manage",
    "collection.read",
    "electronic-invoicing.manage",
    "electronic-invoicing.read",
    "recurring-invoice.manage",
    "recurring-invoice.read",
    "commission.manage",
    "commission.read",
    "fixed-asset.manage",
    "fixed-asset.read",
  ],
  CAJERO: [
    // Explicitamente SIN product.price.update / product.cost.update / product.barcode.update / product.delete
    "product.read",
    // Solo lectura de listas de precios (puede elegir/ver una al vender, no crearlas ni fijar
    // precios) -- mismo criterio que product.read vs product.price.update en este mismo rol.
    "price-list.read",
    "sale.create",
    "sale.read",
    "quote.create",
    "customer.read",
    "customer.manage",
    "opportunity.manage",
    "opportunity.read",
    "cash.session.open",
    "cash.session.close",
    "cash.movement.create",
    "dashboard.read",
    "timetracking.clock",
    "timeoff.request",
  ],
  EMPLEADO: ["dashboard.read", "timetracking.clock", "timeoff.request"],
};
