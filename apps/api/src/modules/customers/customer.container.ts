import { PrismaAuditLogRepository } from "../audit/infrastructure/prisma-audit-log.repository";
import { AuditService } from "../audit/application/audit.service";
import { priceListRepository } from "../inventory/price-list/price-list.container";
import { PrismaCustomerRepository } from "./infrastructure/prisma-customer.repository";
import { CreateCustomerUseCase } from "./application/use-cases/create-customer.use-case";
import { ListCustomersUseCase } from "./application/use-cases/list-customers.use-case";
import { UpdateCustomerPriceListUseCase } from "./application/use-cases/update-customer-price-list.use-case";
import { CustomerController } from "./interfaces/customer.controller";

const repo = new PrismaCustomerRepository();
const auditService = new AuditService(new PrismaAuditLogRepository());

export const customerController = new CustomerController(
  new CreateCustomerUseCase(repo),
  new ListCustomersUseCase(repo),
  new UpdateCustomerPriceListUseCase(repo, priceListRepository, auditService)
);

/** Usado por electronic-invoicing.container.ts para leer los datos del cliente al facturar. */
export const customerRepo = repo;
