import type { NoteElectronicStatus } from "../../credit-note/domain/credit-note.repository";

export interface CreateDebitNoteData {
  branchId: string;
  /** Null = consumidor final. */
  customerId: string | null;
  saleId: string;
  /** Concepto de correccion DIAN (ver DEBIT_NOTE_CONCEPTS). */
  conceptCode: string;
  reason: string;
  amount: number;
}

export interface DebitNoteRecord {
  id: string;
  saleId: string | null;
  conceptCode: string;
  amount: number;
  reason: string;
  status: string;
  createdAt: Date;
  electronic: NoteElectronicStatus | null;
}

export interface IDebitNoteRepository {
  create(data: CreateDebitNoteData): Promise<DebitNoteRecord>;
  list(): Promise<DebitNoteRecord[]>;
}
