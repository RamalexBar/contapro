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

export interface CreditNoteInput {
  branchId: string;
  customerId: string;
  saleId?: string;
  reason: string;
  amount: number;
}

export interface CreditNoteRecord {
  id: string;
  amount: number;
  reason: string;
  status: string;
  createdAt: string;
}

export function listCreditNotes(): Promise<{ data: CreditNoteRecord[] }> {
  return apiFetch("/credit-notes");
}

export function createCreditNote(input: CreditNoteInput): Promise<CreditNoteRecord> {
  return apiFetch("/credit-notes", { method: "POST", body: input });
}

export interface DebitNoteInput {
  branchId: string;
  customerId: string;
  saleId?: string;
  reason: string;
  amount: number;
}

export interface DebitNoteRecord {
  id: string;
  amount: number;
  reason: string;
  status: string;
  createdAt: string;
}

export function listDebitNotes(): Promise<{ data: DebitNoteRecord[] }> {
  return apiFetch("/debit-notes");
}

export function createDebitNote(input: DebitNoteInput): Promise<DebitNoteRecord> {
  return apiFetch("/debit-notes", { method: "POST", body: input });
}
