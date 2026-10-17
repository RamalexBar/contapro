import type { DocumentFileInput } from "../../../shared/ai/document-file";

/** Categoria de gasto de la empresa que se le ofrece al lector para que elija la mas adecuada. */
export interface ExpenseCategoryOption {
  code: string;
  name: string;
}

/** Lo que se lee de la foto o PDF del soporte de un gasto (recibo, factura de servicio, cuenta). */
export interface ExtractedExpenseReceipt {
  /** A quien se le pago: empresa de servicios, arrendador, proveedor... */
  payeeName: string | null;
  payeeNit: string | null;
  documentNumber: string | null;
  /** ISO yyyy-mm-dd. */
  issueDate: string | null;
  /** Que se pago, en pocas palabras (ej. "Energia septiembre 2026"). */
  description: string | null;
  subtotal: number | null;
  taxTotal: number | null;
  total: number | null;
  /** Codigo de la categoria de la empresa que mejor corresponde, o null si ninguna encaja. */
  categoryCode: string | null;
  /** Datos ilegibles o que el usuario deberia revisar; nunca bloquea la lectura. */
  warnings: string[];
}

/**
 * Lectura automatica del soporte de un gasto -- implementado por ClaudeReceiptExtractionService.
 * Solo lectura: devuelve un borrador para que el usuario revise y registre con POST /expenses.
 */
export interface IReceiptExtractionService {
  extract(file: DocumentFileInput, categories: ExpenseCategoryOption[]): Promise<ExtractedExpenseReceipt>;
}
