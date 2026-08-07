export type DepreciationEntryStatus = "CALCULATED" | "POSTED";

export interface DepreciationEntryRecord {
  id: string;
  fixedAssetId: string;
  year: number;
  month: number;
  amount: number;
  status: DepreciationEntryStatus;
  calculatedAt: Date;
  postedAt: Date | null;
  journalEntryId: string | null;
}

export interface UpsertDepreciationEntryForPeriodData {
  fixedAssetId: string;
  year: number;
  month: number;
  amount: number;
}

export interface MarkPostedData {
  journalEntryId: string | null;
  postedAt: Date;
}

export interface ListDepreciationEntriesFilter {
  year?: number;
  month?: number;
  status?: DepreciationEntryStatus;
}

export interface IDepreciationEntryRepository {
  /** Crea o actualiza la entrada del activo para ese periodo -- SIN pisar una entrada ya POSTED
   * (mismo criterio que ICommissionSettlementRepository.upsertForPeriod). Devuelve null si la
   * entrada existente ya estaba POSTED (no se toco). */
  upsertForPeriod(data: UpsertDepreciationEntryForPeriodData): Promise<DepreciationEntryRecord | null>;
  list(filter?: ListDepreciationEntriesFilter): Promise<DepreciationEntryRecord[]>;
  findByIdOrThrow(id: string): Promise<DepreciationEntryRecord>;
  markPosted(id: string, data: MarkPostedData): Promise<DepreciationEntryRecord>;
}
