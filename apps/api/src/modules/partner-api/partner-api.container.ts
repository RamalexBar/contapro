import { AuditService } from "../audit/application/audit.service";
import { PrismaAuditLogRepository } from "../audit/infrastructure/prisma-audit-log.repository";
import { ProvisionPartnerAccountUseCase } from "./application/use-cases/provision-partner-account.use-case";
import { PrismaPartnerAccountRepository } from "./infrastructure/prisma-partner-account.repository";
import { PartnerApiController } from "./interfaces/partner-api.controller";
import { createLoginLinkUseCase } from "../auth/auth.container";

const auditService = new AuditService(new PrismaAuditLogRepository());

const accountRepo = new PrismaPartnerAccountRepository();

export const partnerApiController = new PartnerApiController(
  new ProvisionPartnerAccountUseCase(accountRepo, auditService),
  accountRepo,
  createLoginLinkUseCase
);
