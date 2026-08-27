import { Router } from "express";
import { tenantContextMiddleware } from "../../../shared/middlewares/tenant-context.middleware";
import { requirePermission } from "../../../shared/middlewares/require-permission.middleware";
import { suppliersController } from "../suppliers.container";

export const suppliersRouter = Router();
suppliersRouter.use(tenantContextMiddleware);

suppliersRouter.get("/suppliers", requirePermission("suppliers.read"), suppliersController.listSuppliers);
suppliersRouter.post("/suppliers", requirePermission("suppliers.manage"), suppliersController.createSupplier);

suppliersRouter.post("/purchases", requirePermission("suppliers.manage"), suppliersController.createPurchase);
suppliersRouter.post("/purchases/extract", requirePermission("suppliers.manage"), suppliersController.extractPurchaseInvoice);
suppliersRouter.get("/purchases", requirePermission("suppliers.read"), suppliersController.listPurchases);
suppliersRouter.post("/purchases/:id/cancel", requirePermission("suppliers.manage"), suppliersController.cancelPurchase);

suppliersRouter.post("/purchase-orders", requirePermission("suppliers.manage"), suppliersController.createPurchaseOrder);
suppliersRouter.get("/purchase-orders", requirePermission("suppliers.read"), suppliersController.listPurchaseOrders);
suppliersRouter.get("/purchase-orders/:id", requirePermission("suppliers.read"), suppliersController.getPurchaseOrder);
suppliersRouter.post("/purchase-orders/:id/send", requirePermission("suppliers.manage"), suppliersController.sendPurchaseOrder);

suppliersRouter.post("/goods-receipts", requirePermission("suppliers.manage"), suppliersController.receiveGoods);
suppliersRouter.get("/goods-receipts", requirePermission("suppliers.read"), suppliersController.listGoodsReceipts);
suppliersRouter.get("/goods-receipts/:id", requirePermission("suppliers.read"), suppliersController.getGoodsReceipt);

suppliersRouter.get("/accounts-payable", requirePermission("suppliers.read"), suppliersController.listAccountsPayable);
suppliersRouter.post("/accounts-payable/:id/payments", requirePermission("suppliers.manage"), suppliersController.registerSupplierPayment);
