export interface AccountPayableRecord {
  id: string;
  supplierId: string;
  purchaseId: string;
  /** Se toma de Purchase.branchId (AccountPayable no tiene su propia sucursal) -- se usa para
   * contabilizar el abono en la sucursal correcta. */
  branchId: string;
  amount: number;
  balance: number;
  dueDate: Date;
  status: string;
}

export interface SupplierPaymentRecord {
  id: string;
  accountPayableId: string;
  amount: number;
  method: string;
  paidAt: Date;
}

export interface RegisterPaymentResult {
  payment: SupplierPaymentRecord;
  accountPayable: AccountPayableRecord;
}

export interface IAccountPayableRepository {
  list(filter?: { status?: string }): Promise<AccountPayableRecord[]>;
  findByIdOrThrow(id: string): Promise<AccountPayableRecord>;
  /** Valida amount <= balance DENTRO de la transaccion (mismo criterio que
   * PrismaStockMovementRepository.adjust() usa para no dejar el inventario en negativo), para
   * que dos abonos concurrentes no puedan sobregirar el saldo. */
  registerPayment(accountPayableId: string, amount: number, method: string, userId: string): Promise<RegisterPaymentResult>;
}
