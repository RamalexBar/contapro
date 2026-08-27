export interface InvoiceFileInput {
  /** Base64 sin el prefijo "data:...;base64,". */
  base64: string;
  mediaType: "image/jpeg" | "image/png" | "image/webp" | "application/pdf";
}

export interface ExtractedPurchaseInvoice {
  supplierName: string | null;
  supplierNit: string | null;
  invoiceNumber: string | null;
  /** ISO yyyy-mm-dd, tal como aparece en la factura -- null si no se pudo leer con confianza. */
  issueDate: string | null;
  subtotal: number | null;
  taxTotal: number | null;
  total: number | null;
  /** ISO 4217, "COP" si no se detecta ninguna otra moneda en el documento. */
  currency: string;
  /** Cosas que el modelo no pudo leer con confianza o que el usuario deberia revisar a mano
   * antes de confirmar -- nunca bloquea la extraccion, solo informa. */
  warnings: string[];
}

/**
 * Puerto de lectura automatica de facturas de compra -- implementado por
 * ClaudeInvoiceExtractionService (Claude API, vision). El caso de uso dueño
 * (ExtractPurchaseInvoiceUseCase) importa este puerto desde suppliers.container.ts, nunca al
 * reves. Es de solo lectura: nunca crea un Purchase, solo devuelve un borrador para que el
 * usuario revise y confirme con el POST /purchases ya existente.
 */
export interface IInvoiceExtractionService {
  extract(file: InvoiceFileInput): Promise<ExtractedPurchaseInvoice>;
}
