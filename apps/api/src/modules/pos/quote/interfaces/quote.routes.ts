import { Router } from "express";
import { tenantContextMiddleware } from "../../../../shared/middlewares/tenant-context.middleware";
import { requirePermission } from "../../../../shared/middlewares/require-permission.middleware";
import { quoteController } from "../quote.container";

export const quoteRouter = Router();
quoteRouter.use(tenantContextMiddleware);

quoteRouter.get("/quotes", requirePermission("sale.read"), quoteController.list);
quoteRouter.post("/quotes", requirePermission("quote.create"), quoteController.create);
