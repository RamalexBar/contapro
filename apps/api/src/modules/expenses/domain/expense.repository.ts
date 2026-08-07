export interface CreateExpenseData {
  branchId: string;
  expenseCategoryId: string;
  payeeName: string;
  description?: string;
  date: Date;
  subtotal: number;
  taxTotal: number;
  total: number;
  paymentMethod: string;
  createdByUserId: string;
  costCenterId?: string | null;
}

export interface ExpenseRecord {
  id: string;
  branchId: string;
  expenseCategoryId: string;
  payeeName: string;
  description: string | null;
  date: Date;
  subtotal: number;
  taxTotal: number;
  total: number;
  paymentMethod: string;
  costCenterId: string | null;
  status: string;
  journalEntryId: string | null;
  createdByUserId: string;
  createdAt: Date;
}

export interface IExpenseRepository {
  create(data: CreateExpenseData): Promise<ExpenseRecord>;
  findByIdOrThrow(id: string): Promise<ExpenseRecord>;
  list(filters: { take?: number; skip?: number }): Promise<ExpenseRecord[]>;
  /** Se llama despues de create(), una vez se conoce el id del comprobante contable que
   * PostExpenseJournalEntryUseCase genero -- mismo criterio que Purchase.journalEntryId. */
  setJournalEntryId(id: string, journalEntryId: string): Promise<void>;
  /** Marca el gasto como CANCELLED. El llamador (CancelExpenseUseCase) anula el comprobante por
   * separado via voidJournalEntryUseCase. */
  cancel(id: string): Promise<ExpenseRecord>;
}
