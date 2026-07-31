/**
 * BankTransaction.type ("DEBIT"/"CREDIT") se interpreta desde el punto de vista del extracto
 * bancario (igual que un estado de cuenta real que el usuario transcribe a mano, ya que no hay
 * integracion real con ningun banco): CREDIT = dinero que entro a la cuenta, DEBIT = dinero que
 * salio. No hay ninguna convencion previa en el codebase que lo defina, se documenta aqui.
 */
export interface CreateBankTransactionData {
  bankAccountId: string;
  date: Date;
  description: string;
  amount: number;
  type: "DEBIT" | "CREDIT";
}

export interface BankTransactionRecord {
  id: string;
  bankAccountId: string;
  date: Date;
  description: string;
  amount: number;
  type: string;
  reconciled: boolean;
}

export interface BankTransactionTypeSum {
  type: string;
  total: number;
}

export interface IBankTransactionRepository {
  create(data: CreateBankTransactionData): Promise<BankTransactionRecord>;
  list(bankAccountId: string): Promise<BankTransactionRecord[]>;
  findByIdOrThrow(id: string): Promise<BankTransactionRecord>;
  markReconciled(id: string): Promise<void>;
  /** Usado por AccountingReportsService.getCashFlow -- agregado por companyId via la relacion
   * a BankAccount (BankTransaction no tiene columna companyId propia). */
  sumByType(from: Date, to: Date): Promise<BankTransactionTypeSum[]>;
}
