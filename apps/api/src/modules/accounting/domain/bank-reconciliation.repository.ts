export interface StartBankReconciliationData {
  bankAccountId: string;
  periodStart: Date;
  periodEnd: Date;
  statementBalance: number;
  /** Saldo segun libros al iniciar la conciliacion -- dato de entrada, no se deriva del libro
   * mayor (no hay enlace en el schema entre BankAccount y una cuenta de ChartOfAccounts). */
  bookBalance: number;
}

export interface BankReconciliationItemRecord {
  id: string;
  bankTransactionId: string | null;
  journalEntryLineId: string | null;
  matched: boolean;
}

export interface BankReconciliationRecord {
  id: string;
  bankAccountId: string;
  periodStart: Date;
  periodEnd: Date;
  statementBalance: number;
  bookBalance: number;
  status: string;
  createdAt: Date;
  items: BankReconciliationItemRecord[];
}

export interface AddBankReconciliationMatchData {
  bankTransactionId?: string;
  journalEntryLineId?: string;
}

export interface IBankReconciliationRepository {
  start(data: StartBankReconciliationData): Promise<BankReconciliationRecord>;
  findByIdOrThrow(id: string): Promise<BankReconciliationRecord>;
  list(): Promise<BankReconciliationRecord[]>;
  /** Crea el BankReconciliationItem (matched=true) y, si viene bankTransactionId, marca esa
   * BankTransaction.reconciled=true -- en una sola transaccion. */
  addMatch(reconciliationId: string, data: AddBankReconciliationMatchData): Promise<BankReconciliationRecord>;
  /** IN_PROGRESS -> COMPLETED. No exige diferencia cero -- la diferencia final queda visible en
   * la respuesta para que el usuario decida (statementBalance vs bookBalance). */
  close(reconciliationId: string): Promise<BankReconciliationRecord>;
}
