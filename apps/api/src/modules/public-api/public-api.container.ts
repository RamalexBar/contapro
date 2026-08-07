import { PrismaAuditLogRepository } from "../audit/infrastructure/prisma-audit-log.repository";
import { AuditService } from "../audit/application/audit.service";
import { productRepo } from "../inventory/product/product.container";
import { customerRepo } from "../customers/customer.container";
import { createSaleUseCase } from "../pos/sale/sale.container";
import { PrismaSaleRepository } from "../pos/sale/infrastructure/prisma-sale.repository";
import { PrismaApiKeyRepository } from "./infrastructure/prisma-api-key.repository";
import { CreateApiKeyUseCase } from "./application/use-cases/create-api-key.use-case";
import { ListApiKeysUseCase } from "./application/use-cases/list-api-keys.use-case";
import { DeactivateApiKeyUseCase } from "./application/use-cases/deactivate-api-key.use-case";
import { ApiKeyController } from "./interfaces/api-key.controller";
import { PublicApiController } from "./interfaces/public-api.controller";

const apiKeyRepo = new PrismaApiKeyRepository();
const auditService = new AuditService(new PrismaAuditLogRepository());

export const apiKeyController = new ApiKeyController(
  new CreateApiKeyUseCase(apiKeyRepo, auditService),
  new ListApiKeysUseCase(apiKeyRepo),
  new DeactivateApiKeyUseCase(apiKeyRepo, auditService)
);

// PrismaSaleRepository propia (sin estado, seguro instanciarla aparte de sale.container.ts, que
// no la exporta) -- solo para el listado de ventas de la API publica; la creacion reusa
// createSaleUseCase completo (con toda su logica de negocio), nunca el repo directo.
const saleRepoForListing = new PrismaSaleRepository();

export const publicApiController = new PublicApiController(productRepo, customerRepo, saleRepoForListing, createSaleUseCase);
