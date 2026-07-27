import { Router } from "express";
import { tenantContextMiddleware } from "../../../../shared/middlewares/tenant-context.middleware";
import { requirePermission } from "../../../../shared/middlewares/require-permission.middleware";
import { productController } from "../product.container";

export const productRouter = Router();
productRouter.use(tenantContextMiddleware);

productRouter.get("/products", requirePermission("product.read"), productController.list);
productRouter.get("/products/:id", requirePermission("product.read"), productController.getById);
productRouter.post("/products", requirePermission("product.create"), productController.create);
productRouter.patch("/products/:id", requirePermission("product.update"), productController.update);

// Seguridad de productos: el Cajero NO tiene estos permisos por defecto (ver seed.ts).
productRouter.patch("/products/:id/price", requirePermission("product.price.update"), productController.updatePrice);
productRouter.patch("/products/:id/barcode", requirePermission("product.barcode.update"), productController.updateBarcode);
productRouter.delete("/products/:id", requirePermission("product.delete"), productController.remove);
