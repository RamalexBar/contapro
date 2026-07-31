import { PrismaAuditLogRepository } from "../../audit/infrastructure/prisma-audit-log.repository";
import { AuditService } from "../../audit/application/audit.service";
import { PrismaUserRepository } from "../../auth/infrastructure/prisma-user.repository";
import { postSaleJournalEntryUseCase } from "../../accounting/accounting.container";
import { generateElectronicInvoiceUseCase } from "../../electronic-invoicing/electronic-invoicing.container";
import { productRepo } from "../../inventory/product/product.container";
import { PrismaSaleRepository } from "./infrastructure/prisma-sale.repository";
import { PrismaDiscountLimitRepository } from "./infrastructure/prisma-discount-limit.repository";
import { CreateSaleUseCase } from "./application/use-cases/create-sale.use-case";
import { AuthorizeDiscountUseCase } from "./application/use-cases/authorize-discount.use-case";
import { CancelSaleUseCase } from "./application/use-cases/cancel-sale.use-case";
import { GetSaleUseCase } from "./application/use-cases/get-sale.use-case";
import { ListSalesUseCase } from "./application/use-cases/list-sales.use-case";
import { SaleController } from "./interfaces/sale.controller";

const saleRepo = new PrismaSaleRepository();
const discountLimitRepo = new PrismaDiscountLimitRepository();
const userRepo = new PrismaUserRepository();
const auditService = new AuditService(new PrismaAuditLogRepository());

/** Usado tambien por sync.container.ts para reproducir ventas encoladas offline (mismo caso de
 * uso que POST /sales, ver push-sync-events.use-case.ts). */
export const createSaleUseCase = new CreateSaleUseCase(
  saleRepo,
  productRepo,
  discountLimitRepo,
  postSaleJournalEntryUseCase,
  generateElectronicInvoiceUseCase,
  auditService
);

export const saleController = new SaleController(
  createSaleUseCase,
  new AuthorizeDiscountUseCase(
    saleRepo,
    userRepo,
    postSaleJournalEntryUseCase,
    generateElectronicInvoiceUseCase,
    productRepo,
    auditService
  ),
  new CancelSaleUseCase(saleRepo, auditService),
  new GetSaleUseCase(saleRepo),
  new ListSalesUseCase(saleRepo)
);
