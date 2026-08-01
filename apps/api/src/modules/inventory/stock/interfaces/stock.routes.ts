import { Router } from "express";
import { tenantContextMiddleware } from "../../../../shared/middlewares/tenant-context.middleware";
import { requirePermission } from "../../../../shared/middlewares/require-permission.middleware";
import { stockController } from "../stock.container";

export const stockRouter = Router();
stockRouter.use(tenantContextMiddleware);

stockRouter.post("/stock/entries", requirePermission("stock.entry.create"), stockController.registerEntry);
stockRouter.post("/stock/adjustments", requirePermission("stock.adjust"), stockController.adjust);
stockRouter.post("/stock/transfers", requirePermission("stock.transfer"), stockController.transfer);
stockRouter.get("/kardex", requirePermission("product.read"), stockController.listKardex);
