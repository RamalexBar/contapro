import { PrismaPurchaseRepository } from "../suppliers/infrastructure/prisma-purchase.repository";
import { PrismaSupplierRepository } from "../suppliers/infrastructure/prisma-supplier.repository";
import { PrismaAccountPayableRepository } from "../suppliers/infrastructure/prisma-account-payable.repository";
import { PrismaSaleRepository } from "../pos/sale/infrastructure/prisma-sale.repository";
import { customerRepo } from "../customers/customer.container";
import { accountReceivableRepo } from "../collections/collections.container";
import { withholdingConceptRepository } from "../accounting/accounting.container";
import { ExogenaReportService } from "./application/exogena-report.service";
import { ExogenaController } from "./interfaces/exogena.controller";

// Instancias propias, no importadas de sus containers dueños (que no las exportan): mismo
// criterio ya documentado en suppliers.container.ts -- el repositorio no tiene estado propio,
// instanciarlo dos veces es seguro.
const purchaseRepo = new PrismaPurchaseRepository();
const supplierRepo = new PrismaSupplierRepository();
const accountPayableRepo = new PrismaAccountPayableRepository();
const saleRepo = new PrismaSaleRepository();

const exogenaReportService = new ExogenaReportService(
  purchaseRepo,
  saleRepo,
  supplierRepo,
  customerRepo,
  accountPayableRepo,
  accountReceivableRepo,
  withholdingConceptRepository
);

export const exogenaController = new ExogenaController(exogenaReportService);
