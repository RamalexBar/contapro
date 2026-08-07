import { PrismaAuditLogRepository } from "../audit/infrastructure/prisma-audit-log.repository";
import { AuditService } from "../audit/application/audit.service";
import { customerRepo } from "../customers/customer.container";
import { productRepo } from "../inventory/product/product.container";
import { priceListRepository } from "../inventory/price-list/price-list.container";
import { createSaleUseCase } from "../pos/sale/sale.container";
import { PrismaRecurringInvoiceRepository } from "./infrastructure/prisma-recurring-invoice.repository";
import { CreateRecurringInvoiceUseCase } from "./application/use-cases/create-recurring-invoice.use-case";
import { UpdateRecurringInvoiceUseCase } from "./application/use-cases/update-recurring-invoice.use-case";
import { DeactivateRecurringInvoiceUseCase } from "./application/use-cases/deactivate-recurring-invoice.use-case";
import { ListRecurringInvoicesUseCase } from "./application/use-cases/list-recurring-invoices.use-case";
import { ListRecurringInvoiceRunsUseCase } from "./application/use-cases/list-recurring-invoice-runs.use-case";
import { RunRecurringInvoicesUseCase } from "./application/use-cases/run-recurring-invoices.use-case";
import { RecurringInvoiceController } from "./interfaces/recurring-invoice.controller";

const recurringInvoiceRepo = new PrismaRecurringInvoiceRepository();
const auditService = new AuditService(new PrismaAuditLogRepository());

export const recurringInvoiceController = new RecurringInvoiceController(
  new CreateRecurringInvoiceUseCase(recurringInvoiceRepo, customerRepo, productRepo, priceListRepository, auditService),
  new UpdateRecurringInvoiceUseCase(recurringInvoiceRepo, productRepo, priceListRepository, auditService),
  new DeactivateRecurringInvoiceUseCase(recurringInvoiceRepo, auditService),
  new ListRecurringInvoicesUseCase(recurringInvoiceRepo),
  new ListRecurringInvoiceRunsUseCase(recurringInvoiceRepo)
);

/** Usado por server.ts para arrancar el poller (ver recurring-invoice-poller.ts). */
export const runRecurringInvoicesUseCase = new RunRecurringInvoicesUseCase(
  recurringInvoiceRepo,
  productRepo,
  priceListRepository,
  createSaleUseCase,
  auditService
);
