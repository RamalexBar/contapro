export interface AccountReceivableRecord {
  id: string;
  customerId: string;
  saleId: string;
  /** Se toma de Sale.branchId (AccountReceivable no tiene su propia sucursal) -- mismo criterio
   * que AccountPayable.branchId via Purchase.branchId. */
  branchId: string;
  amount: number;
  balance: number;
  dueDate: Date;
  status: string; // PENDING, PARTIAL, PAID, CANCELLED
}

export interface CreateAccountReceivableData {
  customerId: string;
  saleId: string;
  amount: number;
  dueDate: Date;
}

export interface AccountReceivablePaymentRecord {
  id: string;
  accountReceivableId: string;
  amount: number;
  method: string;
  status: "PENDING" | "REGISTERED" | "FAILED";
  reference: string | null;
  paidAt: Date;
}

export interface RegisterReceivablePaymentResult {
  payment: AccountReceivablePaymentRecord;
  accountReceivable: AccountReceivableRecord;
}

/** Fila cruda encontrada por referencia, sin scoping de tenant -- ver
 * findPaymentByReferenceCrossTenant. */
export interface ReceivablePaymentWithCompany {
  payment: AccountReceivablePaymentRecord;
  companyId: string;
}

export interface IAccountReceivableRepository {
  /** Creada dentro de la transaccion de PrismaSaleRepository.create() cuando la venta trae un
   * pago CREDIT -- este metodo lo usa solo AuthorizeDiscountUseCase, para el caso en que la
   * venta necesito autorizacion de descuento y por eso no se creo al momento de CreateSaleUseCase
   * (ver resolve-receivable-input.ts para el porque el vencimiento por defecto puede diferir en
   * ese caso). */
  create(data: CreateAccountReceivableData): Promise<AccountReceivableRecord>;
  list(filter?: { status?: string }): Promise<AccountReceivableRecord[]>;
  findByIdOrThrow(id: string): Promise<AccountReceivableRecord>;
  /** PENDING/PARTIAL, para el poller de recordatorios. */
  listActive(): Promise<AccountReceivableRecord[]>;
  /** Abono en persona: crea el pago ya REGISTERED y decrementa balance en la misma transaccion
   * (valida amount <= balance dentro de la transaccion, mismo criterio que
   * PrismaAccountPayableRepository.registerPayment). */
  registerPayment(accountReceivableId: string, amount: number, method: string, userId: string): Promise<RegisterReceivablePaymentResult>;
  /** Pago en linea: crea el pago en PENDING con su reference unica, SIN tocar balance todavia
   * (se decrementa recien cuando el webhook confirma, ver confirmCheckoutPayment). */
  createPendingCheckoutPayment(accountReceivableId: string, amount: number, reference: string): Promise<AccountReceivablePaymentRecord>;
  /** Busqueda por reference SIN scoping de tenant (basePrisma) -- el webhook de Wompi no trae
   * contexto de tenant, mismo motivo que ConfirmWompiPaymentUseCase en saas-admin. Devuelve
   * tambien el companyId para que el caller pueda entrar en tenantStorage.run. */
  findPaymentByReferenceCrossTenant(reference: string): Promise<ReceivablePaymentWithCompany | null>;
  /** PENDING -> REGISTERED + decrementa balance, dentro de tenantStorage.run (ver caller). */
  confirmCheckoutPayment(paymentId: string): Promise<RegisterReceivablePaymentResult>;
  /** PENDING -> FAILED, sin tocar balance. */
  failCheckoutPayment(paymentId: string): Promise<AccountReceivablePaymentRecord>;
  /** Rechaza si ya tiene algun pago PENDING/REGISTERED (mismo criterio de guarda que
   * CancelPurchaseUseCase, pero sin reversar automaticamente -- no es el foco de este item). */
  cancel(accountReceivableId: string): Promise<AccountReceivableRecord>;
  hasReminderLog(accountReceivableId: string, daysBeforeDue: number): Promise<boolean>;
  createReminderLog(accountReceivableId: string, daysBeforeDue: number, channel: string): Promise<void>;
}
