import { PrismaAuditLogRepository } from "../../audit/infrastructure/prisma-audit-log.repository";
import { AuditService } from "../../audit/application/audit.service";
// Reusa la instancia ya wireada en sale.container.ts en vez de reimplementar
// CreateSaleUseCase -- mismo patron que accounting.container.ts/collections.container.ts. Sentido
// unico crm -> pos/sale: sale.container.ts no importa nada de aqui, no hay ciclo.
import { createSaleUseCase } from "../../pos/sale/sale.container";
import { PrismaOpportunityRepository } from "./infrastructure/prisma-opportunity.repository";
import { CreateOpportunityUseCase } from "./application/use-cases/create-opportunity.use-case";
import { ListOpportunitiesUseCase } from "./application/use-cases/list-opportunities.use-case";
import { UpdateStageUseCase } from "./application/use-cases/update-stage.use-case";
import { CloseOpportunityAsWonUseCase } from "./application/use-cases/close-opportunity-as-won.use-case";
import { OpportunityController } from "./interfaces/opportunity.controller";

const opportunityRepo = new PrismaOpportunityRepository();
const auditService = new AuditService(new PrismaAuditLogRepository());

export const opportunityController = new OpportunityController(
  new CreateOpportunityUseCase(opportunityRepo, auditService),
  new ListOpportunitiesUseCase(opportunityRepo),
  new UpdateStageUseCase(opportunityRepo, auditService),
  new CloseOpportunityAsWonUseCase(opportunityRepo, createSaleUseCase, auditService)
);
