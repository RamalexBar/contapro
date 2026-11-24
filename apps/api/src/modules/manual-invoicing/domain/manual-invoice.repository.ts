export interface ManualInvoiceItemInput {
  description: string;
  quantity: number;
  unitPrice: number;
  taxPercent: number;
  /** IVA (por defecto) | INC | EXEMPT | EXCLUDED */
  taxType?: string;
  taxAmount: number;
  total: number;
}

export interface ManualInvoiceItemRecord extends ManualInvoiceItemInput {
  id: string;
}

export interface CreateManualInvoiceData {
  branchId: string;
  customerId: string | null;
  createdByUserId: string;
  issueDate: Date;
  subtotal: number;
  taxTotal: number;
  total: number;
  /** Vencimiento de la cuenta por cobrar (con cliente). */
  dueDate?: Date | null;
  items: ManualInvoiceItemInput[];
}

export interface ManualInvoiceRecord {
  id: string;
  branchId: string;
  customerId: string | null;
  createdByUserId: string;
  issueDate: Date;
  subtotal: number;
  taxTotal: number;
  total: number;
  cufe: string | null;
  invoiceXmlUrl: string | null;
  createdAt: Date;
  dueDate: Date | null;
  journalEntryId: string | null;
  items: ManualInvoiceItemRecord[];
}

export interface IManualInvoiceRepository {
  create(data: CreateManualInvoiceData): Promise<ManualInvoiceRecord>;
  setJournalEntryId(id: string, journalEntryId: string): Promise<void>;
  findByIdOrThrow(id: string): Promise<ManualInvoiceRecord>;
  list(): Promise<ManualInvoiceRecord[]>;
}
