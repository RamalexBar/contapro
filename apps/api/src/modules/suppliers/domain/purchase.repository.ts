import type { WithholdingType } from "../../accounting/domain/withholding-concept.repository";

export interface ComputedPurchaseWithholding {
  withholdingConceptId: string;
  type: WithholdingType;
  base: number;
  ratePercent: number;
  amount: number;
}

export interface CreatePurchaseData {
  branchId: string;
  supplierId: string;
  invoiceNumber: string;
  subtotal: number;
  taxTotal: number;
  total: number;
  dueDate: Date;
  retentionTotal: number;
  withholdings: ComputedPurchaseWithholding[];
  // Multi-moneda informativa (item 33 de docs/ALCANCE.md) -- ver suppliers.prisma.
  currency: string;
  exchangeRate: number;
}

export interface PurchaseRecord {
  id: string;
  branchId: string;
  supplierId: string;
  invoiceNumber: string;
  subtotal: number;
  taxTotal: number;
  total: number;
  retentionTotal: number;
  withholdings: ComputedPurchaseWithholding[];
  status: string;
  createdAt: Date;
  accountPayableId: string;
  dueDate: Date;
  journalEntryId: string | null;
  // Multi-moneda informativa (item 33) -- foreignTotal es derivado (null si currency === "COP").
  currency: string;
  exchangeRate: number;
  foreignTotal: number | null;
}

export interface IPurchaseRepository {
  create(data: CreatePurchaseData): Promise<PurchaseRecord>;
  findByIdOrThrow(id: string): Promise<PurchaseRecord>;
  list(filters: { take?: number; skip?: number }): Promise<PurchaseRecord[]>;
  /** Todas las compras REGISTERED (excluye CANCELLED) creadas dentro del año calendario dado --
   * usado por el reporte de informacion exogena DIAN (item 37 de docs/ALCANCE.md). Sin paginar:
   * el reporte necesita el total exacto del año, no una pagina. */
  listForYear(year: number): Promise<PurchaseRecord[]>;
  /** Se llama despues de create(), una vez se conoce el id del comprobante contable que
   * PostPurchaseJournalEntryUseCase genero -- se guarda para poder anularlo si la compra se
   * cancela (CancelPurchaseUseCase). */
  setJournalEntryId(id: string, journalEntryId: string): Promise<void>;
  /** Marca Purchase y su AccountPayable como CANCELLED en una sola transaccion. El llamador
   * (CancelPurchaseUseCase) ya valido que la cuenta por pagar no tiene abonos todavia. */
  cancel(id: string): Promise<PurchaseRecord>;
}
