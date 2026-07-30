import { Prisma } from "@erp/database";
import { getTenantContext } from "../context/request-context";

/**
 * Modelos que pertenecen a un tenant (tienen columna companyId). Todo modelo nuevo con
 * companyId debe agregarse aqui o quedara SIN el filtro automatico de aislamiento.
 */
// NOTA: "Role" se excluye a proposito. Role.companyId es nullable (null = rol de sistema,
// compartido entre TODAS las empresas) y las consultas necesitan combinar
// `OR: [{ companyId }, { companyId: null }]` -- la inyeccion automatica de companyId de esta
// extension romperia ese OR (quedaria ANDeado). El filtrado de Role se hace a mano en
// PrismaRoleRepository usando el companyId que le pasa el caso de uso.
const TENANT_MODELS = new Set([
  "Branch",
  "User",
  "AuditLog",
  "CashierDiscountLimit",
  "DiscountAuthorization",
  "Category",
  "Brand",
  "Product",
  "Barcode",
  "ProductBranchStock",
  "Batch",
  "StockMovement",
  "StockTransfer",
  "PhysicalInventory",
  "Kardex",
  "Sale",
  "Quote",
  "Order",
  "Return",
  "CreditNote",
  "DebitNote",
  "Layaway",
  "Customer",
  "Supplier",
  "PurchaseOrder",
  "GoodsReceipt",
  "Purchase",
  "AccountPayable",
  "CashRegister",
  "CashSession",
  "ChartOfAccounts",
  "JournalEntry",
  "FinancialPeriod",
  "BankAccount",
  "Employee",
  "Payroll",
  "SyncDevice",
  "SyncOutbox",
  "InvoiceNumberingResolution",
  "ElectronicInvoice",
]);

const MULTI_ROW_READ_OPS = new Set(["findMany", "findFirst", "findFirstOrThrow", "count", "aggregate", "groupBy"]);
const MULTI_ROW_WRITE_OPS = new Set(["updateMany", "deleteMany"]);

/**
 * Prisma Client Extension que inyecta automaticamente `companyId` (tomado del
 * AsyncLocalStorage de la request) en las operaciones multi-fila y en `create`.
 *
 * IMPORTANTE: `update` / `delete` / `findUnique` por `id` NO quedan cubiertos aqui (Prisma no
 * permite mutar el `where` de un findUnique con campos extra sin convertirlo en findFirst).
 * Todo repositorio DEBE hacer `findFirst({ where: { id, companyId } })` para confirmar la
 * pertenencia al tenant antes de un `update`/`delete` por id. Ver README.md de esta carpeta.
 */
export const tenantExtension = Prisma.defineExtension((client) =>
  client.$extends({
    name: "tenant-isolation",
    query: {
      $allModels: {
        async $allOperations({ model, operation, args, query }) {
          if (!model || !TENANT_MODELS.has(model)) {
            return query(args);
          }

          const typedArgs = args as { where?: Record<string, unknown>; data?: unknown };

          if (MULTI_ROW_READ_OPS.has(operation) || MULTI_ROW_WRITE_OPS.has(operation)) {
            typedArgs.where = { ...(typedArgs.where ?? {}), companyId: getTenantContext().companyId };
          }

          // create/createMany: solo se auto-inyecta companyId si el llamador no lo trae ya
          // explicito (ej. flujos previos al login, como el registro de intentos fallidos,
          // que corren fuera del AsyncLocalStorage y arman el companyId a mano).
          if (operation === "create") {
            const data = typedArgs.data as Record<string, unknown>;
            if (data?.companyId === undefined) {
              typedArgs.data = { ...data, companyId: getTenantContext().companyId };
            }
          }

          if (operation === "createMany" && Array.isArray(typedArgs.data as unknown[])) {
            const rows = typedArgs.data as Record<string, unknown>[];
            const needsContext = rows.some((row) => row.companyId === undefined);
            const companyId = needsContext ? getTenantContext().companyId : undefined;
            typedArgs.data = rows.map((row) => (row.companyId === undefined ? { ...row, companyId } : row));
          }

          return query(typedArgs as typeof args);
        },
      },
    },
  })
);
