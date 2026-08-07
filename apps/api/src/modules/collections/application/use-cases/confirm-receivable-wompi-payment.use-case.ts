import { tenantStorage } from "../../../../shared/context/request-context";
import { AuditService } from "../../../audit/application/audit.service";
import { PrismaAuditLogRepository } from "../../../audit/infrastructure/prisma-audit-log.repository";
import type { IPaymentGateway, WompiWebhookEvent } from "../../../saas-admin/domain/payment-gateway";
import type { PostReceivableCollectionJournalEntryUseCase } from "../../../accounting/application/use-cases/post-receivable-collection-journal-entry.use-case";
import type { IAccountReceivableRepository } from "../../domain/account-receivable.repository";
import { PrismaCustomerRepository } from "../../../customers/infrastructure/prisma-customer.repository";

const APPROVED_STATUS = "APPROVED";
const FAILED_STATUSES = new Set(["DECLINED", "ERROR", "VOIDED"]);

/**
 * Procesa el webhook "transaction.updated" de Wompi para cobros de cuentas por cobrar (item 31)
 * -- calco de ConfirmWompiPaymentUseCase (saas-admin), con una diferencia estructural real: ese
 * caso de uso opera sobre Subscription, que NO es tenant-scoped (basePrisma sin restriccion).
 * AccountReceivable SI lo es (esta en TENANT_MODELS), asi que aqui hace falta un paso extra:
 * ubicar el pago por `reference` SIN contexto de tenant (el webhook no trae JWT,
 * findPaymentByReferenceCrossTenant usa basePrisma), y solo despues de saber a que companyId
 * pertenece, entrar en tenantStorage.run(...) para poder usar los repos/casos de uso
 * tenant-scoped normales (mismo truco que ya usa dian-submission-poller.ts para correr codigo
 * tenant-scoped fuera de un request HTTP).
 */
export class ConfirmReceivableWompiPaymentUseCase {
  constructor(
    private readonly accountReceivableRepo: IAccountReceivableRepository,
    private readonly paymentGateway: IPaymentGateway,
    private readonly postReceivableCollectionJournalEntry: PostReceivableCollectionJournalEntryUseCase
  ) {}

  async execute(event: WompiWebhookEvent): Promise<void> {
    if (event.event !== "transaction.updated") return;
    if (!this.paymentGateway.verifyWebhookSignature(event)) return;

    const { reference, status } = event.data.transaction;
    const found = await this.accountReceivableRepo.findPaymentByReferenceCrossTenant(reference);
    if (!found || found.payment.status !== "PENDING") return;

    await tenantStorage.run(
      { companyId: found.companyId, branchId: null, userId: "system", roles: [], permissions: new Set() },
      async () => {
        const audit = new AuditService(new PrismaAuditLogRepository());
        const customerRepo = new PrismaCustomerRepository();

        if (status === APPROVED_STATUS) {
          const result = await this.accountReceivableRepo.confirmCheckoutPayment(found.payment.id);
          const customer = await customerRepo.findByIdOrThrow(result.accountReceivable.customerId);

          await this.postReceivableCollectionJournalEntry.execute({
            accountReceivablePaymentId: result.payment.id,
            branchId: result.accountReceivable.branchId,
            date: result.payment.paidAt,
            customerName: customer.name,
            amount: result.payment.amount,
            method: "WOMPI",
          });

          await audit.record({
            action: "RECEIVABLE_PAYMENT_CONFIRMED",
            entityType: "AccountReceivable",
            entityId: result.accountReceivable.id,
            description: `Pago Wompi confirmado: ${result.payment.amount} de ${customer.name} (saldo restante: ${result.accountReceivable.balance})`,
            metadata: { reference, wompiTransactionId: event.data.transaction.id },
          });
        } else if (FAILED_STATUSES.has(status)) {
          await this.accountReceivableRepo.failCheckoutPayment(found.payment.id);
        }
      }
    );
  }
}
