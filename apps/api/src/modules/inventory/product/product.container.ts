import { PrismaAuditLogRepository } from "../../audit/infrastructure/prisma-audit-log.repository";
import { AuditService } from "../../audit/application/audit.service";
import { PrismaProductRepository } from "./infrastructure/prisma-product.repository";
import { CreateProductUseCase } from "./application/use-cases/create-product.use-case";
import { UpdateProductUseCase } from "./application/use-cases/update-product.use-case";
import { UpdateProductPriceUseCase } from "./application/use-cases/update-product-price.use-case";
import { UpdateProductBarcodeUseCase } from "./application/use-cases/update-product-barcode.use-case";
import { DeleteProductUseCase } from "./application/use-cases/delete-product.use-case";
import { ListProductsUseCase } from "./application/use-cases/list-products.use-case";
import { ProductController } from "./interfaces/product.controller";

const productRepo = new PrismaProductRepository();
const auditService = new AuditService(new PrismaAuditLogRepository());

export const productController = new ProductController(
  productRepo,
  new CreateProductUseCase(productRepo, auditService),
  new UpdateProductUseCase(productRepo, auditService),
  new UpdateProductPriceUseCase(productRepo, auditService),
  new UpdateProductBarcodeUseCase(productRepo, auditService),
  new DeleteProductUseCase(productRepo, auditService),
  new ListProductsUseCase(productRepo)
);

export { productRepo };
