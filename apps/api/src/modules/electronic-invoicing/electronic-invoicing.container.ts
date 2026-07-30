import { PrismaAuditLogRepository } from "../audit/infrastructure/prisma-audit-log.repository";
import { AuditService } from "../audit/application/audit.service";
import { customerRepo } from "../customers/customer.container";
import { PrismaElectronicInvoiceRepository } from "./infrastructure/prisma-electronic-invoice.repository";
import { PrismaInvoiceNumberingResolutionRepository } from "./infrastructure/prisma-invoice-numbering-resolution.repository";
import { PrismaCompanyReaderRepository } from "./infrastructure/prisma-company-reader.repository";
import { GenerateElectronicInvoiceUseCase } from "./application/use-cases/generate-electronic-invoice.use-case";
import { CreateNumberingResolutionUseCase } from "./application/use-cases/create-numbering-resolution.use-case";
import { ListNumberingResolutionsUseCase } from "./application/use-cases/list-numbering-resolutions.use-case";
import { GetElectronicInvoiceUseCase } from "./application/use-cases/get-electronic-invoice.use-case";
import { ElectronicInvoicingController } from "./interfaces/electronic-invoicing.controller";

const electronicInvoiceRepo = new PrismaElectronicInvoiceRepository();
const numberingResolutionRepo = new PrismaInvoiceNumberingResolutionRepository();
const companyReader = new PrismaCompanyReaderRepository();
const auditService = new AuditService(new PrismaAuditLogRepository());

const createResolutionUseCase = new CreateNumberingResolutionUseCase(numberingResolutionRepo, auditService);
const listResolutionsUseCase = new ListNumberingResolutionsUseCase(numberingResolutionRepo);
const getInvoiceUseCase = new GetElectronicInvoiceUseCase(electronicInvoiceRepo);

export const electronicInvoicingController = new ElectronicInvoicingController(
  createResolutionUseCase,
  listResolutionsUseCase,
  getInvoiceUseCase
);

/** Usado por sale.container.ts para generar el CUFE/XML local al completarse una venta. */
export const generateElectronicInvoiceUseCase = new GenerateElectronicInvoiceUseCase(
  electronicInvoiceRepo,
  companyReader,
  customerRepo,
  auditService
);
