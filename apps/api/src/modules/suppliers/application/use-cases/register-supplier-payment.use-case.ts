import { getTenantContext } from "../../../../shared/context/request-context";
import type { AuditService } from "../../../audit/application/audit.service";
import type { PostSupplierPaymentJournalEntryUseCase } from "../../../accounting/application/use-cases/post-supplier-payment-journal-entry.use-case";
import type { IAccountPayableRepository, RegisterPaymentResult } from "../../domain/account-payable.repository";
import type { ISupplierRepository } from "../../domain/supplier.repository";

export interface RegisterSupplierPaymentInput {
  accountPayableId: string;
  amount: number;
  method: string;
}

/**
 * Analogo a CreatePurchaseUseCase: la contabilizacion NO se envuelve en try/catch (mismo criterio
 * ya confirmado en post-purchase-journal-entry.use-case.ts -- es un efecto que debe funcionar, no
 * un efecto secundario tipo DIAN que se pueda degradar).
 */
export class RegisterSupplierPaymentUseCase {
  constructor(
    private readonly accountPayableRepo: IAccountPayableRepository,
    private readonly supplierRepo: ISupplierRepository,
    private readonly postSupplierPaymentJournalEntry: PostSupplierPaymentJournalEntryUseCase,
    private readonly audit: AuditService
  ) {}

  async execute(input: RegisterSupplierPaymentInput): Promise<RegisterPaymentResult> {
    const userId = getTenantContext().userId;
    const result = await this.accountPayableRepo.registerPayment(input.accountPayableId, input.amount, input.method, userId);
    const supplier = await this.supplierRepo.findByIdOrThrow(result.accountPayable.supplierId);

    await this.audit.record({
      action: "SUPPLIER_PAYMENT_REGISTERED",
      entityType: "AccountPayable",
      entityId: input.accountPayableId,
      description: `Abono de ${input.amount} a ${supplier.name} (saldo restante: ${result.accountPayable.balance})`,
    });

    await this.postSupplierPaymentJournalEntry.execute({
      supplierPaymentId: result.payment.id,
      branchId: result.accountPayable.branchId,
      date: result.payment.paidAt,
      supplierName: supplier.name,
      amount: input.amount,
      method: input.method,
    });

    return result;
  }
}
