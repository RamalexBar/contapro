import { PrismaAuditLogRepository } from "../../audit/infrastructure/prisma-audit-log.repository";
import { AuditService } from "../../audit/application/audit.service";
import { postReturnJournalEntryUseCase } from "../../accounting/accounting.container";
import { PrismaSaleRepository } from "../sale/infrastructure/prisma-sale.repository";
import { PrismaReturnRepository } from "./infrastructure/prisma-return.repository";
import { CreateReturnUseCase } from "./application/use-cases/create-return.use-case";
import { ListReturnsUseCase } from "./application/use-cases/list-returns.use-case";
import { ReturnController } from "./interfaces/return.controller";

// Instancia propia, no importada de sale.container.ts (que no la exporta): mismo criterio ya
// documentado en accounting.container.ts para PrismaCashSessionRepository/PrismaSupplierRepository
// -- instanciar dos veces un repo sin estado propio es seguro.
const saleRepo = new PrismaSaleRepository();
const returnRepo = new PrismaReturnRepository();
const auditService = new AuditService(new PrismaAuditLogRepository());

export const returnController = new ReturnController(
  new CreateReturnUseCase(returnRepo, saleRepo, postReturnJournalEntryUseCase, auditService),
  new ListReturnsUseCase(returnRepo)
);
