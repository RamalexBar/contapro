export interface CreatePurchaseData {
  branchId: string;
  supplierId: string;
  invoiceNumber: string;
  subtotal: number;
  taxTotal: number;
  total: number;
  dueDate: Date;
}

export interface PurchaseRecord {
  id: string;
  branchId: string;
  supplierId: string;
  invoiceNumber: string;
  subtotal: number;
  taxTotal: number;
  total: number;
  status: string;
  createdAt: Date;
  accountPayableId: string;
  dueDate: Date;
  journalEntryId: string | null;
}

export interface IPurchaseRepository {
  create(data: CreatePurchaseData): Promise<PurchaseRecord>;
  findByIdOrThrow(id: string): Promise<PurchaseRecord>;
  list(filters: { take?: number; skip?: number }): Promise<PurchaseRecord[]>;
  /** Se llama despues de create(), una vez se conoce el id del comprobante contable que
   * PostPurchaseJournalEntryUseCase genero -- se guarda para poder anularlo si la compra se
   * cancela (CancelPurchaseUseCase). */
  setJournalEntryId(id: string, journalEntryId: string): Promise<void>;
  /** Marca Purchase y su AccountPayable como CANCELLED en una sola transaccion. El llamador
   * (CancelPurchaseUseCase) ya valido que la cuenta por pagar no tiene abonos todavia. */
  cancel(id: string): Promise<PurchaseRecord>;
}
