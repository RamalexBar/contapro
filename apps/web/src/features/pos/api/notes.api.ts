import type { CreateQuoteInput } from "@erp/shared-types";
import { apiFetch, openPdfInNewTab } from "../../../lib/api-client";

export interface QuoteRecord {
  id: string;
  status: string;
  subtotal: number;
  total: number;
  validUntil: string;
  createdAt: string;
}

export function listQuotes(): Promise<{ data: QuoteRecord[] }> {
  return apiFetch("/quotes");
}

export function createQuote(input: CreateQuoteInput): Promise<QuoteRecord> {
  return apiFetch("/quotes", { method: "POST", body: input });
}

export function printQuotePdf(id: string): Promise<void> {
  return openPdfInNewTab(`/quotes/${id}/pdf`);
}

/** Documento electronico de la nota (null = no se genero; el motivo queda en Auditoria). */
export interface NoteElectronicStatus {
  fullNumber: string;
  status: "GENERATED" | "PENDING_SIGNATURE" | "PENDING_SUBMISSION" | "ACCEPTED" | "REJECTED";
  rejectionReason: string | null;
}

/** Conceptos de correccion DIAN que se pueden elegir en una nota libre. Devolucion (1) y anulacion
 * (2) salen de Devoluciones, porque ademas mueven inventario y caja. */
export const CREDIT_NOTE_CONCEPTS: Record<string, string> = {
  "3": "Rebaja o descuento",
  "4": "Ajuste de precio",
  "5": "Descuento por pronto pago",
  "6": "Descuento por volumen",
};
export const CREDIT_NOTE_CONCEPT_LABELS: Record<string, string> = {
  "1": "Devolucion parcial",
  "2": "Anulacion (devolucion total)",
  ...CREDIT_NOTE_CONCEPTS,
};
export const DEBIT_NOTE_CONCEPTS: Record<string, string> = {
  "1": "Intereses",
  "2": "Gastos por cobrar",
  "3": "Cambio del valor",
  "4": "Otros",
};

export interface NoteInput {
  saleId: string;
  conceptCode: string;
  reason: string;
  amount: number;
  /** Solo nota credito: como se devuelve (vacio = abono a la cuenta del cliente, o efectivo si no hay cliente). */
  settlement?: "CASH" | "TRANSFER" | "CREDIT_TO_ACCOUNT";
}

export interface NoteRecord {
  id: string;
  saleId: string | null;
  returnId?: string | null;
  conceptCode: string;
  amount: number;
  reason: string;
  status: string;
  createdAt: string;
  electronic: NoteElectronicStatus | null;
}

export type CreditNoteRecord = NoteRecord;
export type DebitNoteRecord = NoteRecord;

export function listCreditNotes(): Promise<{ data: CreditNoteRecord[] }> {
  return apiFetch("/credit-notes");
}

export function createCreditNote(input: NoteInput): Promise<CreditNoteRecord> {
  return apiFetch("/credit-notes", { method: "POST", body: input });
}

export function listDebitNotes(): Promise<{ data: DebitNoteRecord[] }> {
  return apiFetch("/debit-notes");
}

export function createDebitNote(input: NoteInput): Promise<DebitNoteRecord> {
  return apiFetch("/debit-notes", { method: "POST", body: input });
}

/** Reenvia al proveedor (Factus) o a la DIAN una nota que quedo rechazada o sin enviar. */
export function resubmitNote(kind: "credit" | "debit", noteId: string): Promise<void> {
  return apiFetch(`/electronic-invoicing/${kind}-notes/${noteId}/resubmit`, { method: "POST" });
}

export function printNotePdf(kind: "credit" | "debit", noteId: string): Promise<void> {
  return openPdfInNewTab(`/electronic-invoicing/${kind}-notes/${noteId}/pdf`);
}
