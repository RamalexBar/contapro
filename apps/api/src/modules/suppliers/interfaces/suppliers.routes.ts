import { Router } from "express";
import { tenantContextMiddleware } from "../../../shared/middlewares/tenant-context.middleware";
import { notImplemented } from "../../../shared/middlewares/not-implemented.middleware";

export const suppliersRouter = Router();
suppliersRouter.use(tenantContextMiddleware);

const stub = notImplemented("suppliers");
suppliersRouter.all("/suppliers", stub);
suppliersRouter.all("/purchase-orders", stub);
suppliersRouter.all("/goods-receipts", stub);
suppliersRouter.all("/accounts-payable", stub);
