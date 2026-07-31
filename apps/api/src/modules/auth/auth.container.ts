import { PrismaAuditLogRepository } from "../audit/infrastructure/prisma-audit-log.repository";
import { AuditService } from "../audit/application/audit.service";
// Instancias propias, no importadas de saas-admin.container.ts: ese modulo no necesita nada de
// auth, pero acoplar todo su container aqui solo para 2 repos de solo-lectura seria innecesario.
// Ambos repos son basePrisma sin estado, instanciarlos aqui es seguro (mismo criterio ya usado
// para PrismaSupplierRepository en electronic-invoicing.container.ts).
import { PrismaPlanRepository } from "../saas-admin/infrastructure/prisma-plan.repository";
import { PrismaSubscriptionRepository } from "../saas-admin/infrastructure/prisma-subscription.repository";
import { PrismaUserRepository } from "./infrastructure/prisma-user.repository";
import { LoginUseCase } from "./application/use-cases/login.use-case";
import { RegisterCompanyUseCase } from "./application/use-cases/register-company.use-case";
import { RefreshTokenUseCase } from "./application/use-cases/refresh-token.use-case";
import { LogoutUseCase } from "./application/use-cases/logout.use-case";
import { AuthController } from "./interfaces/auth.controller";

const userRepo = new PrismaUserRepository();
const planRepo = new PrismaPlanRepository();
const subscriptionRepo = new PrismaSubscriptionRepository();
const auditService = new AuditService(new PrismaAuditLogRepository());

export const authController = new AuthController(
  new LoginUseCase(userRepo, auditService),
  new RegisterCompanyUseCase(userRepo, planRepo, subscriptionRepo),
  new RefreshTokenUseCase(userRepo),
  new LogoutUseCase(userRepo, auditService)
);
