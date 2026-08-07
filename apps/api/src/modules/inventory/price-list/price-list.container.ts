import { PrismaAuditLogRepository } from "../../audit/infrastructure/prisma-audit-log.repository";
import { AuditService } from "../../audit/application/audit.service";
import { productRepo } from "../product/product.container";
import { PrismaPriceListRepository } from "./infrastructure/prisma-price-list.repository";
import { CreatePriceListUseCase } from "./application/use-cases/create-price-list.use-case";
import { UpdatePriceListUseCase } from "./application/use-cases/update-price-list.use-case";
import { DeactivatePriceListUseCase } from "./application/use-cases/deactivate-price-list.use-case";
import { ListPriceListsUseCase } from "./application/use-cases/list-price-lists.use-case";
import { ListProductPricesUseCase } from "./application/use-cases/list-product-prices.use-case";
import { SetProductPriceUseCase } from "./application/use-cases/set-product-price.use-case";
import { RemoveProductPriceUseCase } from "./application/use-cases/remove-product-price.use-case";
import { PriceListController } from "./interfaces/price-list.controller";

const priceListRepo = new PrismaPriceListRepository();
const auditService = new AuditService(new PrismaAuditLogRepository());

export const priceListController = new PriceListController(
  new CreatePriceListUseCase(priceListRepo, auditService),
  new UpdatePriceListUseCase(priceListRepo, auditService),
  new DeactivatePriceListUseCase(priceListRepo, auditService),
  new ListPriceListsUseCase(priceListRepo),
  new ListProductPricesUseCase(priceListRepo),
  new SetProductPriceUseCase(priceListRepo, productRepo, auditService),
  new RemoveProductPriceUseCase(priceListRepo, productRepo, auditService)
);

/** Usado por sale.container.ts/quote.container.ts para resolver el precio efectivo de un
 * producto segun la lista de precios vigente de la venta/cotizacion (item 35). */
export const priceListRepository = priceListRepo;
