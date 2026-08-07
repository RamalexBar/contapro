import { Router } from "express";
import { apiKeyAuthMiddleware } from "../../../shared/middlewares/api-key-auth.middleware";
import { publicApiRateLimiter } from "../../../shared/middlewares/public-api-rate-limit.middleware";
import { requirePermission } from "../../../shared/middlewares/require-permission.middleware";
import { publicApiController } from "../public-api.container";

export const publicApiRouter = Router();
publicApiRouter.use("/public/v1", publicApiRateLimiter, apiKeyAuthMiddleware);

publicApiRouter.get("/public/v1/products", requirePermission("product.read"), publicApiController.listProducts);
publicApiRouter.get("/public/v1/products/:id", requirePermission("product.read"), publicApiController.getProduct);
publicApiRouter.get("/public/v1/customers", requirePermission("customer.read"), publicApiController.listCustomers);
publicApiRouter.post("/public/v1/customers", requirePermission("customer.manage"), publicApiController.createCustomer);
publicApiRouter.get("/public/v1/sales", requirePermission("sale.read"), publicApiController.listSales);
publicApiRouter.post("/public/v1/sales", requirePermission("sale.create"), publicApiController.createSale);
