import { basePrisma } from "@erp/database";
import { tenantExtension } from "./tenant.extension";

/**
 * Cliente Prisma que TODOS los repositorios de modulos de negocio deben importar.
 * Ya incluye el aislamiento multi-tenant automatico (ver tenant.extension.ts).
 */
export const prisma = basePrisma.$extends(tenantExtension);

export type TenantPrismaClient = typeof prisma;
