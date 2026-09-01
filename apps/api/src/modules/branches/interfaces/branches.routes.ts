import { Router } from "express";
import { tenantContextMiddleware } from "../../../shared/middlewares/tenant-context.middleware";
import { requirePermission } from "../../../shared/middlewares/require-permission.middleware";
import { branchesController } from "../branches.container";

/**
 * GET /branches: antes de esto NO EXISTIA en toda la API ningun endpoint para listar las
 * sucursales de la propia empresa -- bloqueaba construir "Traslados entre sucursales", que
 * necesita elegir origen/destino (el resto del sistema hasta entonces solo conocia
 * `user.branchId`, la sucursal por defecto del usuario logueado). Sin permiso dedicado (igual que
 * `GET /employees/me`) -- conocer la lista de sucursales de tu propia empresa no es sensible, y
 * varios roles sin `branch.manage` la necesitan (un Cajero eligiendo sucursal en un traslado, por
 * ejemplo).
 *
 * POST /branches: primer lugar de todo el sistema donde se puede crear una sucursal fuera de la
 * que se crea automaticamente al registrar la empresa -- y por lo tanto el primer lugar que hace
 * cumplir `Plan.maxBranches` (ver CreateBranchUseCase).
 */
export const branchesRouter = Router();
branchesRouter.use(tenantContextMiddleware);

branchesRouter.get("/branches", branchesController.list);
branchesRouter.post("/branches", requirePermission("branch.manage"), branchesController.create);
