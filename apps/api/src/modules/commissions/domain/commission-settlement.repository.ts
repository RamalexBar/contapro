export type CommissionSettlementStatus = "CALCULATED" | "PAID";

export interface CommissionSettlementRecord {
  id: string;
  sellerUserId: string;
  year: number;
  month: number;
  salesBase: number;
  ratePercent: number;
  commissionAmount: number;
  status: CommissionSettlementStatus;
  calculatedAt: Date;
  paidAt: Date | null;
  journalEntryId: string | null;
}

export interface UpsertSettlementForPeriodData {
  sellerUserId: string;
  year: number;
  month: number;
  salesBase: number;
  ratePercent: number;
  commissionAmount: number;
}

export interface MarkPaidData {
  // Null cuando la comision es $0 (tarifa 0%) -- no hay nada que contabilizar, ver
  // PostCommissionJournalEntryUseCase.
  journalEntryId: string | null;
  paidAt: Date;
}

export interface ListSettlementsFilter {
  year?: number;
  month?: number;
  status?: CommissionSettlementStatus;
}

export interface ICommissionSettlementRepository {
  /** Crea o actualiza la liquidacion del vendedor para ese periodo -- SIN pisar una liquidacion
   * ya PAID (CalculateCommissionsUseCase puede recalcular un periodo varias veces antes de pagar,
   * pero un pago ya contabilizado no debe recalcularse por debajo). Devuelve null si la
   * liquidacion existente ya estaba PAID (no se toco). */
  upsertForPeriod(data: UpsertSettlementForPeriodData): Promise<CommissionSettlementRecord | null>;
  list(filter?: ListSettlementsFilter): Promise<CommissionSettlementRecord[]>;
  findByIdOrThrow(id: string): Promise<CommissionSettlementRecord>;
  markPaid(id: string, data: MarkPaidData): Promise<CommissionSettlementRecord>;
}
