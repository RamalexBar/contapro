import { ValidationError } from "../../../../shared/errors/app-error";
import type { AuditService } from "../../../audit/application/audit.service";
import type { IUserDirectoryRepository } from "../../../rbac/domain/rbac.types";
import type { PostCommissionJournalEntryUseCase } from "../../../accounting/application/use-cases/post-commission-journal-entry.use-case";
import type { CommissionSettlementRecord, ICommissionSettlementRepository } from "../../domain/commission-settlement.repository";

export interface PayCommissionSettlementInput {
  id: string;
  branchId: string;
  paymentMethod: string;
}

export class PayCommissionSettlementUseCase {
  constructor(
    private readonly settlementRepo: ICommissionSettlementRepository,
    private readonly userDirectoryRepo: IUserDirectoryRepository,
    private readonly postCommissionJournalEntry: PostCommissionJournalEntryUseCase,
    private readonly audit: AuditService
  ) {}

  async execute(input: PayCommissionSettlementInput): Promise<CommissionSettlementRecord> {
    const settlement = await this.settlementRepo.findByIdOrThrow(input.id);
    if (settlement.status !== "CALCULATED") {
      throw new ValidationError(`La liquidacion ya esta en estado ${settlement.status}, no se puede pagar de nuevo`);
    }

    const users = await this.userDirectoryRepo.list();
    const seller = users.find((u) => u.id === settlement.sellerUserId);

    const entry = await this.postCommissionJournalEntry.execute({
      settlementId: settlement.id,
      branchId: input.branchId,
      date: new Date(),
      sellerName: seller?.fullName ?? settlement.sellerUserId,
      commissionAmount: settlement.commissionAmount,
      paymentMethod: input.paymentMethod,
    });

    const paid = await this.settlementRepo.markPaid(settlement.id, {
      journalEntryId: entry?.id ?? null,
      paidAt: new Date(),
    });

    await this.audit.record({
      action: "COMMISSION_PAID",
      entityType: "CommissionSettlement",
      entityId: paid.id,
      description: `Comision pagada a ${seller?.fullName ?? settlement.sellerUserId}: ${settlement.commissionAmount}`,
    });

    return paid;
  }
}
