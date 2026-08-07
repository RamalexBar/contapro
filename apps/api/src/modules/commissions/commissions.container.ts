import { PrismaAuditLogRepository } from "../audit/infrastructure/prisma-audit-log.repository";
import { AuditService } from "../audit/application/audit.service";
import { PrismaSaleRepository } from "../pos/sale/infrastructure/prisma-sale.repository";
import { PrismaUserDirectoryRepository } from "../rbac/infrastructure/prisma-user-directory.repository";
import { postCommissionJournalEntryUseCase } from "../accounting/accounting.container";
import { PrismaSalesCommissionSchemeRepository } from "./infrastructure/prisma-sales-commission-scheme.repository";
import { PrismaCommissionSettlementRepository } from "./infrastructure/prisma-commission-settlement.repository";
import { CreateSalesCommissionSchemeUseCase } from "./application/use-cases/create-sales-commission-scheme.use-case";
import { UpdateSalesCommissionSchemeUseCase } from "./application/use-cases/update-sales-commission-scheme.use-case";
import { DeactivateSalesCommissionSchemeUseCase } from "./application/use-cases/deactivate-sales-commission-scheme.use-case";
import { ListSalesCommissionSchemesUseCase } from "./application/use-cases/list-sales-commission-schemes.use-case";
import { ListSellersUseCase } from "./application/use-cases/list-sellers.use-case";
import { CalculateCommissionsUseCase } from "./application/use-cases/calculate-commissions.use-case";
import { ListCommissionSettlementsUseCase } from "./application/use-cases/list-commission-settlements.use-case";
import { PayCommissionSettlementUseCase } from "./application/use-cases/pay-commission-settlement.use-case";
import { CommissionsController } from "./interfaces/commissions.controller";

// Instancias propias, no importadas de sus containers dueños (que no las exportan): mismo
// criterio ya documentado en suppliers.container.ts -- el repositorio no tiene estado propio,
// instanciarlo dos veces es seguro.
const saleRepo = new PrismaSaleRepository();
const userDirectoryRepo = new PrismaUserDirectoryRepository();

const schemeRepo = new PrismaSalesCommissionSchemeRepository();
const settlementRepo = new PrismaCommissionSettlementRepository();
const auditService = new AuditService(new PrismaAuditLogRepository());

export const commissionsController = new CommissionsController(
  new CreateSalesCommissionSchemeUseCase(schemeRepo, auditService),
  new UpdateSalesCommissionSchemeUseCase(schemeRepo, auditService),
  new DeactivateSalesCommissionSchemeUseCase(schemeRepo, auditService),
  new ListSalesCommissionSchemesUseCase(schemeRepo),
  new ListSellersUseCase(userDirectoryRepo),
  new CalculateCommissionsUseCase(saleRepo, schemeRepo, settlementRepo, auditService),
  new ListCommissionSettlementsUseCase(settlementRepo),
  new PayCommissionSettlementUseCase(settlementRepo, userDirectoryRepo, postCommissionJournalEntryUseCase, auditService)
);
