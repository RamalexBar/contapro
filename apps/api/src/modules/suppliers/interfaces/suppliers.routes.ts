import { Router } from "express";
import { tenantContextMiddleware } from "../../../shared/middlewares/tenant-context.middleware";
import { requirePermission } from "../../../shared/middlewares/require-permission.middleware";
import { notImplemented } from "../../../shared/middlewares/not-implemented.middleware";
import { suppliersController } from "../suppliers.container";

export const suppliersRouter = Router();
suppliersRouter.use(tenantContextMiddleware);

suppliersRouter.get("/suppliers", requirePermission("suppliers.read"), suppliersController.listSuppliers);
suppliersRouter.post("/suppliers", requirePermission("suppliers.manage"), suppliersController.createSupplier);

suppliersRouter.post("/purchases", requirePermission("suppliers.manage"), suppliersController.createPurchase);

// Orden de compra, recepcion de mercancia y abonos a cuentas por pagar: aun no implementado,
// ver README.md de este modulo.
const stub = notImplemented("suppliers");
suppliersRouter.all("/purchase-orders", stub);
suppliersRouter.all("/goods-receipts", stub);
suppliersRouter.all("/accounts-payable", stub);
