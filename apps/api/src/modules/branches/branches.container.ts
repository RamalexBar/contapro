import { AuditService } from "../audit/application/audit.service";
import { PrismaAuditLogRepository } from "../audit/infrastructure/prisma-audit-log.repository";
import { planRepo, subscriptionRepo } from "../saas-admin/saas-admin.container";
import { PrismaBranchRepository } from "./infrastructure/prisma-branch.repository";
import { CreateBranchUseCase } from "./application/use-cases/create-branch.use-case";
import { ListBranchesUseCase } from "./application/use-cases/list-branches.use-case";
import { BranchesController } from "./interfaces/branches.controller";

const branchRepo = new PrismaBranchRepository();
const auditService = new AuditService(new PrismaAuditLogRepository());

export const branchesController = new BranchesController(
  new CreateBranchUseCase(branchRepo, subscriptionRepo, planRepo, auditService),
  new ListBranchesUseCase(branchRepo)
);
