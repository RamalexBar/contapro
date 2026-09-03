export interface ManualInvoiceItemInput {
  description: string;
  quantity: number;
  unitPrice: number;
  taxPercent: number;
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
  items: ManualInvoiceItemRecord[];
}

export interface IManualInvoiceRepository {
  create(data: CreateManualInvoiceData): Promise<ManualInvoiceRecord>;
  findByIdOrThrow(id: string): Promise<ManualInvoiceRecord>;
  list(): Promise<ManualInvoiceRecord[]>;
}
