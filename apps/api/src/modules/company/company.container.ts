import { PrismaAuditLogRepository } from "../audit/infrastructure/prisma-audit-log.repository";
import { AuditService } from "../audit/application/audit.service";
import { PrismaCompanyProfileRepository } from "./infrastructure/prisma-company-profile.repository";
import { GetCompanyProfileUseCase } from "./application/use-cases/get-company-profile.use-case";
import { UpdateCompanyProfileUseCase } from "./application/use-cases/update-company-profile.use-case";
import { CompanyController } from "./interfaces/company.controller";

const auditService = new AuditService(new PrismaAuditLogRepository());

/** Exportado para que manual-invoicing.container.ts lo importe (validar completitud del perfil
 * antes de crear una factura manual) -- una sola direccion: manual-invoicing -> company, mismo
 * patron que sale -> accounting. */
export const companyProfileRepo = new PrismaCompanyProfileRepository();

const getProfileUseCase = new GetCompanyProfileUseCase(companyProfileRepo);
const updateProfileUseCase = new UpdateCompanyProfileUseCase(companyProfileRepo, auditService);

export const companyController = new CompanyController(getProfileUseCase, updateProfileUseCase);
