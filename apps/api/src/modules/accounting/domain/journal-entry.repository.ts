export interface JournalEntryLineRecord {
  id: string;
  accountId: string;
  debit: number;
  credit: number;
  description: string | null;
}

export interface JournalEntryRecord {
  id: string;
  number: number;
  date: Date;
  description: string;
  type: string; // MANUAL, SALE, RETURN, PURCHASE, PAYROLL, ADJUSTMENT
  sourceType: string | null;
  sourceId: string | null;
  status: string; // DRAFT, POSTED, VOID
  createdByUserId: string;
  postedAt: Date | null;
  // Item 34 de docs/ALCANCE.md: etiquetado opcional para segmentar reportes (ver
  // AccountingReportsService.getIncomeStatement/getLedger).
  costCenterId: string | null;
  lines: JournalEntryLineRecord[];
}

export interface CreateJournalEntryLineData {
  accountId: string;
  debit: number;
  credit: number;
  description?: string;
}

export interface CreateJournalEntryData {
  branchId?: string;
  date: Date;
  description: string;
  type: string;
  sourceType?: string;
  sourceId?: string;
  createdByUserId: string;
  lines: CreateJournalEntryLineData[];
  costCenterId?: string;
}

export interface PostedLineAggregate {
  id: string;
  accountId: string;
  debit: number;
  credit: number;
  date: Date;
  entryId: string;
  entryNumber: number;
  description: string | null;
  // Del JournalEntry padre -- usado por AccountingReportsService/IThirdPartyResolver para
  // desglosar el Balance General por tercero (item nuevo, ver third-party-resolver.ts).
  sourceType: string | null;
  sourceId: string | null;
}

export interface IJournalEntryRepository {
  create(data: CreateJournalEntryData): Promise<JournalEntryRecord>;
  list(filter?: { status?: string }): Promise<JournalEntryRecord[]>;
  findByIdOrThrow(id: string): Promise<JournalEntryRecord>;
  updateStatus(id: string, status: string, postedAt?: Date): Promise<JournalEntryRecord>;
  /** Lineas de comprobantes POSTED, para libro mayor y reportes financieros. `costCenterId`
   * filtra por el campo del mismo nombre en JournalEntry (item 34 de docs/ALCANCE.md) -- se
   * omite del where cuando no se pasa, sin cambiar el comportamiento existente. */
  listPostedLines(filter: { from?: Date; to?: Date; accountId?: string; costCenterId?: string }): Promise<PostedLineAggregate[]>;
  /** Para bloquear el cierre de un periodo con comprobantes sin publicar/anular pendientes. */
  hasDraftEntriesInPeriod(year: number, month: number): Promise<boolean>;
  /** Encuentra el comprobante generado automaticamente para un hecho economico dado (ej. un
   * SupplierPayment especifico), para poder anularlo -- ver sourceType/sourceId en
   * Post*JournalEntryUseCase. null si nunca se genero (ej. contabilizacion en monto cero). */
  findBySource(sourceType: string, sourceId: string): Promise<JournalEntryRecord | null>;
}
