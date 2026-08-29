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
  status: "REGISTERED" | "REVERSED";
  paidAt: Date;
}

export interface RegisterPaymentResult {
  payment: SupplierPaymentRecord;
  accountPayable: AccountPayableRecord;
}

export interface ReversePaymentsResult {
  accountPayable: AccountPayableRecord;
  reversedPayments: SupplierPaymentRecord[];
}

export interface IAccountPayableRepository {
  list(filter?: { status?: string }): Promise<AccountPayableRecord[]>;
  findByIdOrThrow(id: string): Promise<AccountPayableRecord>;
  /** Usado por el boton "Imprimir" del recibo de abono (GET /supplier-payments/:id/pdf) --
   * ninguna otra ruta necesitaba consultar un abono individual por id hasta ahora (registerPayment
   * ya devuelve el creado inline). */
  findPaymentByIdOrThrow(id: string): Promise<SupplierPaymentRecord>;
  /** PENDING/PARTIAL/OVERDUE -- usado por el reporte de informacion exogena DIAN (item 37,
   * formato 1009: saldos de cuentas por pagar) para sumar el saldo actual por proveedor, mismo
   * criterio que IAccountReceivableRepository.listActive(). */
  listActive(): Promise<AccountPayableRecord[]>;
  /** Valida amount <= balance DENTRO de la transaccion (mismo criterio que
   * PrismaStockMovementRepository.adjust() usa para no dejar el inventario en negativo), para
   * que dos abonos concurrentes no puedan sobregirar el saldo. */
  registerPayment(accountPayableId: string, amount: number, method: string, userId: string): Promise<RegisterPaymentResult>;
  /** Marca REVERSED todos los abonos REGISTERED de la cuenta y restaura balance=amount,
   * status=PENDING -- usado por CancelPurchaseUseCase para poder cancelar una compra que ya
   * tiene abonos. No toca los comprobantes contables de cada abono, eso lo hace el caller
   * (necesita VoidJournalEntryUseCase, de otro modulo). No-op (retorna reversedPayments: [])
   * si no hay abonos activos. */
  reverseAllPayments(accountPayableId: string): Promise<ReversePaymentsResult>;
}
