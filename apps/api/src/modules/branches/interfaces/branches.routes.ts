import { Router } from "express";
import { tenantContextMiddleware } from "../../../shared/middlewares/tenant-context.middleware";
import { prisma } from "../../../shared/prisma/prisma-client";
import { getTenantContext } from "../../../shared/context/request-context";

/**
 * Modulo minimo a proposito: antes de esto NO EXISTIA en toda la API ningun endpoint para listar
 * las sucursales de la propia empresa (encontrado durante la revision del modulo de inventario --
 * bloqueaba construir "Traslados entre sucursales", que necesita elegir origen/destino). El resto
 * del sistema hasta ahora solo conocia `user.branchId` (la sucursal por defecto del usuario
 * logueado, ver `AuthenticatedUser`), nunca la lista completa.
 *
 * Se salta a proposito la capa completa (dominio/aplicacion/infraestructura) que usa el resto de
 * modulos: es una sola consulta de solo lectura sobre datos que ya estan protegidos por el
 * `TenantContext` (el cliente Prisma extendido inyecta `companyId` solo, ver
 * shared/prisma/prisma-client.ts), sin logica de negocio que justifique un caso de uso separado.
 * Sin permiso dedicado (igual que `GET /employees/me`) -- conocer la lista de sucursales de tu
 * propia empresa no es sensible, y varios roles sin `rbac.manage` la necesitan (Supervisor
 * haciendo un traslado de stock, por ejemplo).
 */
export const branchesRouter = Router();
branchesRouter.use(tenantContextMiddleware);

branchesRouter.get("/branches", async (_req, res, next) => {
  try {
    const { companyId } = getTenantContext();
    const branches = await prisma.branch.findMany({
      where: { companyId, isActive: true },
      select: { id: true, name: true, code: true, isMain: true },
      orderBy: { name: "asc" },
    });
    res.json({ data: branches });
  } catch (err) {
    next(err);
  }
});
