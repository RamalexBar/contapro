import { PrismaAuditLogRepository } from "../audit/infrastructure/prisma-audit-log.repository";
import { AuditService } from "../audit/application/audit.service";
import { postPurchaseJournalEntryUseCase } from "../accounting/accounting.container";
import { generateElectronicSupportDocumentUseCase } from "../electronic-invoicing/electronic-invoicing.container";
import { PrismaSupplierRepository } from "./infrastructure/prisma-supplier.repository";
import { PrismaPurchaseRepository } from "./infrastructure/prisma-purchase.repository";
import { CreateSupplierUseCase } from "./application/use-cases/create-supplier.use-case";
import { ListSuppliersUseCase } from "./application/use-cases/list-suppliers.use-case";
import { CreatePurchaseUseCase } from "./application/use-cases/create-purchase.use-case";
import { SuppliersController } from "./interfaces/suppliers.controller";

const supplierRepo = new PrismaSupplierRepository();
const purchaseRepo = new PrismaPurchaseRepository();
const auditService = new AuditService(new PrismaAuditLogRepository());

export const suppliersController = new SuppliersController(
  new CreateSupplierUseCase(supplierRepo, auditService),
  new ListSuppliersUseCase(supplierRepo),
  new CreatePurchaseUseCase(
    purchaseRepo,
    supplierRepo,
    postPurchaseJournalEntryUseCase,
    generateElectronicSupportDocumentUseCase,
    auditService
  )
);
