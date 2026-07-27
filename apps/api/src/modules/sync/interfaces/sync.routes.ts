import { Router } from "express";
import { tenantContextMiddleware } from "../../../shared/middlewares/tenant-context.middleware";
import { notImplemented } from "../../../shared/middlewares/not-implemented.middleware";

export const syncRouter = Router();
syncRouter.use(tenantContextMiddleware);

const stub = notImplemented("sync");
syncRouter.all("/sync/push", stub);
syncRouter.all("/sync/pull", stub);
