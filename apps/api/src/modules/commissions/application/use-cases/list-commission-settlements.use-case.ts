import type {
  CommissionSettlementRecord,
  ICommissionSettlementRepository,
  ListSettlementsFilter,
} from "../../domain/commission-settlement.repository";

export class ListCommissionSettlementsUseCase {
  constructor(private readonly repo: ICommissionSettlementRepository) {}

  execute(filter?: ListSettlementsFilter): Promise<CommissionSettlementRecord[]> {
    return this.repo.list(filter);
  }
}
