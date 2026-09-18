export interface StatementFileInput {
  /** Base64 sin el prefijo "data:...;base64,". */
  base64: string;
  mediaType: "image/jpeg" | "image/png" | "image/webp" | "application/pdf";
}

export interface ExtractedBankTransaction {
  /** ISO yyyy-mm-dd tal como aparece en el extracto. */
  date: string;
  description: string;
  amount: number;
  /** CREDIT = dinero que entro a la cuenta, DEBIT = dinero que salio -- misma convencion que
   * BankTransaction.type (ver domain/bank-transaction.repository.ts). */
  type: "DEBIT" | "CREDIT";
}

export interface ExtractedBankStatement {
  transactions: ExtractedBankTransaction[];
  /** Notas cortas en español sobre filas ilegibles u omitidas, o inconsistencias del extracto --
   * nunca bloquea la extraccion, solo informa. Lista vacia si todo se leyo con confianza. */
  warnings: string[];
}

/**
 * Puerto de lectura automatica de extractos bancarios (foto/PDF) -- implementado por
 * ClaudeStatementExtractionService (Claude API, vision). El caso de uso dueño
 * (ExtractBankStatementUseCase) importa este puerto desde accounting.container.ts, nunca al
 * reves. Es de solo lectura: nunca crea ningun BankTransaction, solo devuelve un borrador de
 * movimientos para que el usuario revise, deseleccione los que no quiera y confirme -- cada uno
 * se registra despues con el POST /bank-accounts/:id/transactions ya existente (mismo criterio
 * que invoice-extraction.port.ts en el modulo de proveedores).
 */
export interface IStatementExtractionService {
  extract(file: StatementFileInput): Promise<ExtractedBankStatement>;
}
