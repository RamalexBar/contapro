import { PrismaAuditLogRepository } from "../../audit/infrastructure/prisma-audit-log.repository";
import { AuditService } from "../../audit/application/audit.service";
import { PrismaProductRepository } from "./infrastructure/prisma-product.repository";
import { CreateProductUseCase } from "./application/use-cases/create-product.use-case";
import { UpdateProductUseCase } from "./application/use-cases/update-product.use-case";
import { UpdateProductPriceUseCase } from "./application/use-cases/update-product-price.use-case";
import { UpdateProductBarcodeUseCase } from "./application/use-cases/update-product-barcode.use-case";
import { DeleteProductUseCase } from "./application/use-cases/delete-product.use-case";
import { ImportProductsUseCase } from "./application/use-cases/import-products.use-case";
import { PrismaCategoryRepository } from "../category/infrastructure/prisma-category.repository";
import { ListProductsUseCase } from "./application/use-cases/list-products.use-case";
import { ProductController } from "./interfaces/product.controller";

const productRepo = new PrismaProductRepository();
const auditService = new AuditService(new PrismaAuditLogRepository());
const createProductUseCase = new CreateProductUseCase(productRepo, auditService);

export const productController = new ProductController(
  productRepo,
  createProductUseCase,
  new UpdateProductUseCase(productRepo, auditService),
  new UpdateProductPriceUseCase(productRepo, auditService),
  new UpdateProductBarcodeUseCase(productRepo, auditService),
  new DeleteProductUseCase(productRepo, auditService),
  new ListProductsUseCase(productRepo),
  new ImportProductsUseCase(productRepo, new PrismaCategoryRepository(), createProductUseCase)
);

// createProductUseCase se exporta para Registrar compra (suppliers): crea los productos nuevos que trae la factura.
export { productRepo, createProductUseCase };
