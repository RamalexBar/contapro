import { PrismaAuditLogRepository } from "../audit/infrastructure/prisma-audit-log.repository";
import { AuditService } from "../audit/application/audit.service";
import { companyProfileRepo } from "../company/company.container";
import { generateElectronicInvoiceUseCase } from "../electronic-invoicing/electronic-invoicing.container";
import { PrismaManualInvoiceRepository } from "./infrastructure/prisma-manual-invoice.repository";
import { CreateManualInvoiceUseCase } from "./application/use-cases/create-manual-invoice.use-case";
import { GetManualInvoiceUseCase } from "./application/use-cases/get-manual-invoice.use-case";
import { ListManualInvoicesUseCase } from "./application/use-cases/list-manual-invoices.use-case";
import { ManualInvoicingController } from "./interfaces/manual-invoicing.controller";

const manualInvoiceRepo = new PrismaManualInvoiceRepository();
const auditService = new AuditService(new PrismaAuditLogRepository());

const createUseCase = new CreateManualInvoiceUseCase(manualInvoiceRepo, companyProfileRepo, generateElectronicInvoiceUseCase, auditService);
const getUseCase = new GetManualInvoiceUseCase(manualInvoiceRepo);
const listUseCase = new ListManualInvoicesUseCase(manualInvoiceRepo);

export const manualInvoicingController = new ManualInvoicingController(createUseCase, getUseCase, listUseCase);
