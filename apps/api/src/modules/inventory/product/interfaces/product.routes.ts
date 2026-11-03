import { Router } from "express";
import { tenantContextMiddleware } from "../../../../shared/middlewares/tenant-context.middleware";
import { requirePermission } from "../../../../shared/middlewares/require-permission.middleware";
import { productController, productPhotoController } from "../product.container";

/** La foto se sirve sin sesion (la protege su direccion firmada): va montada antes que los routers con sesion. */
export const productPhotoPublicRouter = Router();
productPhotoPublicRouter.get("/product-photos/:id", productPhotoController.serve);

export const productRouter = Router();
productRouter.use(tenantContextMiddleware);

productRouter.get("/products", requirePermission("product.read"), productController.list);
productRouter.get("/products/:id", requirePermission("product.read"), productController.getById);
productRouter.post("/products", requirePermission("product.create"), productController.create);
// Carga masiva desde Excel/CSV/Alegra/Siigo: crea categorias faltantes por nombre como parte del
// mismo alta, asi que no exige category.manage aparte (ver README del modulo).
productRouter.post("/products/import", requirePermission("product.create"), productController.importProducts);
productRouter.patch("/products/:id", requirePermission("product.update"), productController.update);

// Seguridad de productos: el Cajero NO tiene estos permisos por defecto (ver seed.ts).
productRouter.patch("/products/:id/price", requirePermission("product.price.update"), productController.updatePrice);
productRouter.patch("/products/:id/barcode", requirePermission("product.barcode.update"), productController.updateBarcode);
productRouter.delete("/products/:id", requirePermission("product.delete"), productController.remove);
productRouter.put("/products/:id/photo", requirePermission("product.update"), productPhotoController.set);
productRouter.delete("/products/:id/photo", requirePermission("product.update"), productPhotoController.remove);
