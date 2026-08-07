import { getTenantContext } from "../../../../shared/context/request-context";
import type { AuditService } from "../../../audit/application/audit.service";
import type { PostReceivableCollectionJournalEntryUseCase } from "../../../accounting/application/use-cases/post-receivable-collection-journal-entry.use-case";
import type { IAccountReceivableRepository, RegisterReceivablePaymentResult } from "../../domain/account-receivable.repository";
import type { ICustomerRepository } from "../../../customers/domain/customer.repository";

export interface RegisterReceivablePaymentInput {
  accountReceivableId: string;
  amount: number;
  method: string;
}

/**
 * Abono en persona (efectivo/tarjeta/transferencia recibido directamente): analogo a
 * RegisterSupplierPaymentUseCase, la contabilizacion NO se envuelve en try/catch (mismo criterio
 * ya confirmado alli -- es un efecto que debe funcionar, no uno tipo DIAN que se pueda degradar).
 */
export class RegisterReceivablePaymentUseCase {
  constructor(
    private readonly accountReceivableRepo: IAccountReceivableRepository,
    private readonly customerRepo: ICustomerRepository,
    private readonly postReceivableCollectionJournalEntry: PostReceivableCollectionJournalEntryUseCase,
    private readonly audit: AuditService
  ) {}

  async execute(input: RegisterReceivablePaymentInput): Promise<RegisterReceivablePaymentResult> {
    const userId = getTenantContext().userId;
    const result = await this.accountReceivableRepo.registerPayment(input.accountReceivableId, input.amount, input.method, userId);
    const customer = await this.customerRepo.findByIdOrThrow(result.accountReceivable.customerId);

    await this.audit.record({
      action: "RECEIVABLE_PAYMENT_REGISTERED",
      entityType: "AccountReceivable",
      entityId: input.accountReceivableId,
      description: `Cobro de ${input.amount} a ${customer.name} (saldo restante: ${result.accountReceivable.balance})`,
    });

    await this.postReceivableCollectionJournalEntry.execute({
      accountReceivablePaymentId: result.payment.id,
      branchId: result.accountReceivable.branchId,
      date: result.payment.paidAt,
      customerName: customer.name,
      amount: input.amount,
      method: input.method,
    });

    return result;
  }
}
