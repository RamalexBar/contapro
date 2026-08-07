import { Router } from "express";
import { tenantContextMiddleware } from "../../../../shared/middlewares/tenant-context.middleware";
import { requirePermission } from "../../../../shared/middlewares/require-permission.middleware";
import { priceListController } from "../price-list.container";

export const priceListRouter = Router();
priceListRouter.use(tenantContextMiddleware);

priceListRouter.get("/price-lists", requirePermission("price-list.read"), priceListController.list);
priceListRouter.post("/price-lists", requirePermission("price-list.manage"), priceListController.create);
priceListRouter.patch("/price-lists/:id", requirePermission("price-list.manage"), priceListController.update);
priceListRouter.post("/price-lists/:id/deactivate", requirePermission("price-list.manage"), priceListController.deactivate);

priceListRouter.get(
  "/price-lists/:id/prices",
  requirePermission("price-list.read"),
  priceListController.listProductPrices
);
priceListRouter.put(
  "/price-lists/:id/products/:productId/price",
  requirePermission("price-list.manage"),
  priceListController.setProductPrice
);
priceListRouter.delete(
  "/price-lists/:id/products/:productId/price",
  requirePermission("price-list.manage"),
  priceListController.removeProductPrice
);
