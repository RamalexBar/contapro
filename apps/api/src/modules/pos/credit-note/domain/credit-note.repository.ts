export interface CreateCreditNoteData {
  branchId: string;
  /** Null = consumidor final. */
  customerId: string | null;
  saleId: string;
  /** Devolucion que origino la nota (null = nota libre). */
  returnId?: string | null;
  /** Concepto de correccion DIAN (ver CREDIT_NOTE_CONCEPTS). */
  conceptCode: string;
  reason: string;
  amount: number;
}

/** Estado del documento electronico de la nota (null = no se genero, ver Auditoria). */
export interface NoteElectronicStatus {
  fullNumber: string;
  status: string;
  rejectionReason: string | null;
}

export interface CreditNoteRecord {
  id: string;
  saleId: string | null;
  returnId: string | null;
  conceptCode: string;
  amount: number;
  reason: string;
  status: string;
  createdAt: Date;
  electronic: NoteElectronicStatus | null;
}

export interface ICreditNoteRepository {
  create(data: CreateCreditNoteData): Promise<CreditNoteRecord>;
  list(): Promise<CreditNoteRecord[]>;
  /** Suma de las notas credito ya emitidas sobre la venta (para no acreditar mas de lo facturado). */
  totalCreditedForSale(saleId: string): Promise<number>;
}
