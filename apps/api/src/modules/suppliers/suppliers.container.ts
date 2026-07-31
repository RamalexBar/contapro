import { PrismaAuditLogRepository } from "../audit/infrastructure/prisma-audit-log.repository";
import { AuditService } from "../audit/application/audit.service";
import { postPurchaseJournalEntryUseCase, postSupplierPaymentJournalEntryUseCase, voidJournalEntryUseCase } from "../accounting/accounting.container";
import { generateElectronicSupportDocumentUseCase } from "../electronic-invoicing/electronic-invoicing.container";
import { stockRepo } from "../inventory/stock/stock.container";
import { PrismaSupplierRepository } from "./infrastructure/prisma-supplier.repository";
import { PrismaPurchaseRepository } from "./infrastructure/prisma-purchase.repository";
import { PrismaPurchaseOrderRepository } from "./infrastructure/prisma-purchase-order.repository";
import { PrismaGoodsReceiptRepository } from "./infrastructure/prisma-goods-receipt.repository";
import { PrismaAccountPayableRepository } from "./infrastructure/prisma-account-payable.repository";
import { CreateSupplierUseCase } from "./application/use-cases/create-supplier.use-case";
import { ListSuppliersUseCase } from "./application/use-cases/list-suppliers.use-case";
import { CreatePurchaseUseCase } from "./application/use-cases/create-purchase.use-case";
import { CreatePurchaseOrderUseCase } from "./application/use-cases/create-purchase-order.use-case";
import { SendPurchaseOrderUseCase } from "./application/use-cases/send-purchase-order.use-case";
import { ListPurchaseOrdersUseCase } from "./application/use-cases/list-purchase-orders.use-case";
import { GetPurchaseOrderUseCase } from "./application/use-cases/get-purchase-order.use-case";
import { ReceiveGoodsUseCase } from "./application/use-cases/receive-goods.use-case";
import { ListGoodsReceiptsUseCase } from "./application/use-cases/list-goods-receipts.use-case";
import { GetGoodsReceiptUseCase } from "./application/use-cases/get-goods-receipt.use-case";
import { ListAccountsPayableUseCase } from "./application/use-cases/list-accounts-payable.use-case";
import { RegisterSupplierPaymentUseCase } from "./application/use-cases/register-supplier-payment.use-case";
import { CancelPurchaseUseCase } from "./application/use-cases/cancel-purchase.use-case";
import { SuppliersController } from "./interfaces/suppliers.controller";

const supplierRepo = new PrismaSupplierRepository();
const purchaseRepo = new PrismaPurchaseRepository();
const purchaseOrderRepo = new PrismaPurchaseOrderRepository();
const goodsReceiptRepo = new PrismaGoodsReceiptRepository();
const accountPayableRepo = new PrismaAccountPayableRepository();
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
  ),
  new CreatePurchaseOrderUseCase(purchaseOrderRepo, auditService),
  new SendPurchaseOrderUseCase(purchaseOrderRepo, auditService),
  new ListPurchaseOrdersUseCase(purchaseOrderRepo),
  new GetPurchaseOrderUseCase(purchaseOrderRepo),
  new ReceiveGoodsUseCase(goodsReceiptRepo, purchaseOrderRepo, stockRepo, auditService),
  new ListGoodsReceiptsUseCase(goodsReceiptRepo),
  new GetGoodsReceiptUseCase(goodsReceiptRepo),
  new ListAccountsPayableUseCase(accountPayableRepo),
  new RegisterSupplierPaymentUseCase(accountPayableRepo, supplierRepo, postSupplierPaymentJournalEntryUseCase, auditService),
  new CancelPurchaseUseCase(purchaseRepo, accountPayableRepo, voidJournalEntryUseCase, auditService)
);
