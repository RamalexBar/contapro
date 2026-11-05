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
import { env } from "../../../config/env";
import { PhotoUrlSigner } from "./application/photo-url-signer";
import {
  AddProductPhotoUseCase,
  ListProductPhotosUseCase,
  RemoveProductPhotoUseCase,
  ServeProductPhotoUseCase,
  SetMainProductPhotoUseCase,
  SetProductPhotoUseCase,
} from "./application/use-cases/product-photo.use-cases";
import { objectStorage } from "../../../shared/storage/storage.container";
import { PrismaProductPhotoRepository } from "./infrastructure/prisma-product-photo.repository";
import { ProductPhotoController } from "./interfaces/product-photo.controller";

const productRepo = new PrismaProductRepository();
const auditService = new AuditService(new PrismaAuditLogRepository());
const createProductUseCase = new CreateProductUseCase(productRepo, auditService);
const photoRepo = new PrismaProductPhotoRepository(objectStorage);
/** Lo usa la cotizacion (pos/quote) para poner la foto de cada producto en su PDF. */
export const productPhotoRepo = photoRepo;
const photoSigner = new PhotoUrlSigner(env.JWT_ACCESS_SECRET);

export const productController = new ProductController(
  productRepo,
  createProductUseCase,
  new UpdateProductUseCase(productRepo, auditService),
  new UpdateProductPriceUseCase(productRepo, auditService),
  new UpdateProductBarcodeUseCase(productRepo, auditService),
  new DeleteProductUseCase(productRepo, auditService),
  new ListProductsUseCase(productRepo, photoSigner),
  new ImportProductsUseCase(productRepo, new PrismaCategoryRepository(), createProductUseCase)
);

/** Fotos del producto: listar/agregar/quitar/principal (con sesion) y servir por su direccion firmada (sin sesion). */
export const productPhotoController = new ProductPhotoController(
  new SetProductPhotoUseCase(productRepo, photoRepo, photoSigner),
  new RemoveProductPhotoUseCase(productRepo, photoRepo),
  new ServeProductPhotoUseCase(photoRepo, photoSigner),
  new ListProductPhotosUseCase(productRepo, photoRepo, photoSigner),
  new AddProductPhotoUseCase(productRepo, photoRepo, photoSigner),
  new SetMainProductPhotoUseCase(productRepo, photoRepo)
);

// createProductUseCase se exporta para Registrar compra (suppliers): crea los productos nuevos que trae la factura.
export { productRepo, createProductUseCase };
