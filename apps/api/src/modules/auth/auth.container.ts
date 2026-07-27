import { PrismaAuditLogRepository } from "../audit/infrastructure/prisma-audit-log.repository";
import { AuditService } from "../audit/application/audit.service";
import { PrismaUserRepository } from "./infrastructure/prisma-user.repository";
import { LoginUseCase } from "./application/use-cases/login.use-case";
import { RegisterCompanyUseCase } from "./application/use-cases/register-company.use-case";
import { RefreshTokenUseCase } from "./application/use-cases/refresh-token.use-case";
import { LogoutUseCase } from "./application/use-cases/logout.use-case";
import { AuthController } from "./interfaces/auth.controller";

const userRepo = new PrismaUserRepository();
const auditService = new AuditService(new PrismaAuditLogRepository());

export const authController = new AuthController(
  new LoginUseCase(userRepo, auditService),
  new RegisterCompanyUseCase(userRepo),
  new RefreshTokenUseCase(userRepo),
  new LogoutUseCase(userRepo, auditService)
);
