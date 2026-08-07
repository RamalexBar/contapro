export interface RecurringInvoiceItemInput {
  productId: string;
  quantity: number;
}

export interface CreateRecurringInvoiceData {
  customerId: string;
  branchId: string;
  name: string;
  dayOfMonth: number;
  priceListId?: string;
  dueDays: number;
  items: RecurringInvoiceItemInput[];
  nextRunDate: Date;
}

export interface UpdateRecurringInvoiceData {
  name?: string;
  dayOfMonth?: number;
  priceListId?: string | null;
  dueDays?: number;
  items?: RecurringInvoiceItemInput[];
  nextRunDate?: Date;
}

export interface RecurringInvoiceRecord {
  id: string;
  customerId: string;
  branchId: string;
  name: string;
  dayOfMonth: number;
  priceListId: string | null;
  dueDays: number;
  isActive: boolean;
  nextRunDate: Date;
  lastRunDate: Date | null;
  items: RecurringInvoiceItemInput[];
  createdAt: Date;
}

export interface AdvanceNextRunData {
  nextRunDate: Date;
  lastRunDate: Date;
}

export interface RecordRunData {
  recurringInvoiceId: string;
  runDate: Date;
  status: "SUCCESS" | "FAILED";
  saleId?: string;
  errorMessage?: string;
}

export interface RecurringInvoiceRunRecord {
  id: string;
  recurringInvoiceId: string;
  runDate: Date;
  status: "SUCCESS" | "FAILED";
  saleId: string | null;
  errorMessage: string | null;
  createdAt: Date;
}

export interface IRecurringInvoiceRepository {
  create(data: CreateRecurringInvoiceData): Promise<RecurringInvoiceRecord>;
  list(): Promise<RecurringInvoiceRecord[]>;
  findByIdOrThrow(id: string): Promise<RecurringInvoiceRecord>;
  update(id: string, data: UpdateRecurringInvoiceData): Promise<RecurringInvoiceRecord>;
  deactivate(id: string): Promise<RecurringInvoiceRecord>;
  /** Plantillas activas con `nextRunDate <= now` -- usado por RunRecurringInvoicesUseCase (el
   * poller). Ya queda auto-scopeada al tenant actual, ver tenant.extension.ts. */
  listDue(now: Date): Promise<RecurringInvoiceRecord[]>;
  advanceNextRun(id: string, data: AdvanceNextRunData): Promise<void>;
  recordRun(data: RecordRunData): Promise<RecurringInvoiceRunRecord>;
  listRuns(recurringInvoiceId: string): Promise<RecurringInvoiceRunRecord[]>;
}
