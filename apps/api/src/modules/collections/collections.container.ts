import { PrismaAuditLogRepository } from "../audit/infrastructure/prisma-audit-log.repository";
import { AuditService } from "../audit/application/audit.service";
import { postReceivableCollectionJournalEntryUseCase } from "../accounting/accounting.container";
import { paymentGateway } from "../saas-admin/saas-admin.container";
import { PrismaCustomerRepository } from "../customers/infrastructure/prisma-customer.repository";
// Instancia propia, NO importada de sale.container.ts: ese container ya importa
// accountReceivableRepo de aqui, importar en la otra direccion crearia un ciclo de modulos.
// PrismaSaleRepository no tiene estado propio, instanciarla dos veces es segura (mismo criterio
// ya usado con PrismaCashSessionRepository en accounting.container.ts).
import { PrismaSaleRepository } from "../pos/sale/infrastructure/prisma-sale.repository";
import { PrismaAccountReceivableRepository } from "./infrastructure/prisma-account-receivable.repository";
import { ResendCollectionReminderNotifier } from "./infrastructure/resend-collection-reminder-notifier";
import { ListAccountsReceivableUseCase } from "./application/use-cases/list-accounts-receivable.use-case";
import { RegisterReceivablePaymentUseCase } from "./application/use-cases/register-receivable-payment.use-case";
import { CreateReceivableCheckoutUseCase } from "./application/use-cases/create-receivable-checkout.use-case";
import { ConfirmReceivableWompiPaymentUseCase } from "./application/use-cases/confirm-receivable-wompi-payment.use-case";
import { RunCollectionsRemindersUseCase } from "./application/use-cases/run-collections-reminders.use-case";
import { whatsAppSender } from "../whatsapp/whatsapp.container";
import { CollectionsController } from "./interfaces/collections.controller";

/** Usado por sale.container.ts (AuthorizeDiscountUseCase, CancelSaleUseCase) para crear/cancelar
 * la AccountReceivable de una venta con pago CREDIT. */
export const accountReceivableRepo = new PrismaAccountReceivableRepository();

const customerRepo = new PrismaCustomerRepository();
const auditService = new AuditService(new PrismaAuditLogRepository());

export const confirmReceivableWompiPaymentUseCase = new ConfirmReceivableWompiPaymentUseCase(
  accountReceivableRepo,
  paymentGateway,
  postReceivableCollectionJournalEntryUseCase
);

export const collectionsController = new CollectionsController(
  new ListAccountsReceivableUseCase(accountReceivableRepo),
  new RegisterReceivablePaymentUseCase(accountReceivableRepo, customerRepo, postReceivableCollectionJournalEntryUseCase, auditService),
  new CreateReceivableCheckoutUseCase(accountReceivableRepo, customerRepo, paymentGateway, auditService),
  confirmReceivableWompiPaymentUseCase,
  accountReceivableRepo,
  customerRepo
);

/** Usado por server.ts para arrancar el poller de recordatorios de cobro. */
export const runCollectionsRemindersUseCase = new RunCollectionsRemindersUseCase(
  accountReceivableRepo,
  customerRepo,
  new PrismaSaleRepository(),
  new ResendCollectionReminderNotifier(),
  whatsAppSender,
  auditService
);
