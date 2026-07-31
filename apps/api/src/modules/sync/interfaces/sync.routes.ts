import { Router } from "express";
import { tenantContextMiddleware } from "../../../shared/middlewares/tenant-context.middleware";
import { requirePermission } from "../../../shared/middlewares/require-permission.middleware";
import { syncController } from "../sync.container";

export const syncRouter = Router();
syncRouter.use(tenantContextMiddleware);

// Reusa permisos ya existentes (sale.create/product.read) en vez de crear permisos nuevos solo
// para sync -- push/pull hacen exactamente lo mismo que POST /sales y GET /products, solo que
// en lote y encolado desde el cliente movil (ver README del modulo).
syncRouter.post("/sync/push", requirePermission("sale.create"), syncController.push);
syncRouter.get("/sync/pull", requirePermission("product.read"), syncController.pull);
