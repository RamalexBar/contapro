export type AuditAction =
  | "PRODUCT_CREATED"
  | "PRODUCT_UPDATED"
  | "PRODUCT_PRICE_CHANGED"
  | "PRODUCT_COST_CHANGED"
  | "PRODUCT_BARCODE_CHANGED"
  | "PRODUCT_DELETED"
  | "STOCK_ENTRY_REGISTERED"
  | "STOCK_ADJUSTED"
  | "SALE_COMPLETED"
  | "SALE_CANCELLED"
  | "RETURN_CREATED"
  | "CREDIT_NOTE_ISSUED"
  | "DEBIT_NOTE_ISSUED"
  | "DISCOUNT_AUTHORIZED"
  | "CASH_SESSION_OPENED"
  | "CASH_SESSION_CLOSED"
  | "CASH_MOVEMENT_REGISTERED"
  | "PERMISSION_CHANGED"
  | "ROLE_ASSIGNED"
  | "ROLE_REMOVED"
  | "USER_CREATED"
  | "USER_UPDATED"
  | "LOGIN_SUCCESS"
  | "LOGIN_FAILED"
  | "LOGOUT"
  | "EMPLOYEE_CREATED"
  | "EMPLOYEE_UPDATED"
  | "EMPLOYEE_DEACTIVATED"
  | "TIME_ENTRY_CLOCK_IN"
  | "TIME_ENTRY_CLOCK_OUT"
  | "VACATION_REQUESTED"
  | "VACATION_APPROVED"
  | "VACATION_REJECTED"
  | "LEAVE_PERMISSION_REQUESTED"
  | "LEAVE_PERMISSION_APPROVED"
  | "LEAVE_PERMISSION_REJECTED"
  | "ABSENCE_REGISTERED"
  | "SICK_LEAVE_SUBMITTED"
  | "SICK_LEAVE_APPROVED"
  | "SICK_LEAVE_REJECTED"
  | "PAYROLL_PARAMETER_CREATED"
  | "PAYROLL_CREATED"
  | "PAYROLL_CALCULATED"
  | "PAYROLL_APPROVED"
  | "PAYROLL_PAID"
  | "ACCOUNT_CREATED"
  | "JOURNAL_ENTRY_CREATED"
  | "JOURNAL_ENTRY_POSTED"
  | "JOURNAL_ENTRY_VOIDED"
  | "SUPPLIER_CREATED"
  | "PURCHASE_REGISTERED"
  | "PURCHASE_ORDER_CREATED"
  | "PURCHASE_ORDER_SENT"
  | "GOODS_RECEIPT_REGISTERED"
  | "SUPPLIER_PAYMENT_REGISTERED"
  | "PURCHASE_CANCELLED"
  | "SUPPLIER_PAYMENT_REVERSED"
  | "BANK_ACCOUNT_CREATED"
  | "BANK_TRANSACTION_REGISTERED"
  | "BANK_RECONCILIATION_STARTED"
  | "BANK_RECONCILIATION_ITEM_MATCHED"
  | "BANK_RECONCILIATION_CLOSED"
  | "FINANCIAL_PERIOD_CLOSED"
  | "FINANCIAL_PERIOD_REOPENED"
  | "SUBSCRIPTION_CREATED"
  | "SUBSCRIPTION_PAYMENT_REGISTERED"
  | "SUBSCRIPTION_STATUS_CHANGED"
  | "INVOICE_NUMBERING_RESOLUTION_CREATED"
  | "ELECTRONIC_INVOICE_GENERATED"
  | "ELECTRONIC_INVOICE_GENERATION_FAILED"
  | "ELECTRONIC_INVOICE_SIGNING_FAILED"
  | "ELECTRONIC_CREDIT_NOTE_GENERATED"
  | "ELECTRONIC_CREDIT_NOTE_GENERATION_FAILED"
  | "ELECTRONIC_CREDIT_NOTE_SIGNING_FAILED"
  | "ELECTRONIC_DEBIT_NOTE_GENERATED"
  | "ELECTRONIC_DEBIT_NOTE_GENERATION_FAILED"
  | "ELECTRONIC_DEBIT_NOTE_SIGNING_FAILED"
  | "ELECTRONIC_SUPPORT_DOCUMENT_GENERATED"
  | "ELECTRONIC_SUPPORT_DOCUMENT_GENERATION_FAILED"
  | "ELECTRONIC_SUPPORT_DOCUMENT_SIGNING_FAILED"
  | "ELECTRONIC_PAYROLL_GENERATED"
  | "ELECTRONIC_PAYROLL_GENERATION_FAILED"
  | "ELECTRONIC_PAYROLL_SIGNING_FAILED"
  // Compartidos por los 5 tipos de documento (factura/nota credito/nota debito/documento
  // soporte/nomina) -- entityType/entityId del registro de auditoria ya distinguen cual es cual.
  | "ELECTRONIC_DOCUMENT_SUBMITTED"
  | "ELECTRONIC_DOCUMENT_ACCEPTED"
  | "ELECTRONIC_DOCUMENT_REJECTED";

export interface AuditLogEntry {
  id: string;
  companyId: string;
  branchId: string | null;
  userId: string | null;
  action: AuditAction;
  entityType: string;
  entityId: string;
  description: string;
  metadata: Record<string, unknown> | null;
  createdAt: Date;
}

export interface CreateAuditLogInput {
  companyId: string;
  branchId: string | null;
  userId: string | null;
  action: AuditAction;
  entityType: string;
  entityId: string;
  description: string;
  metadata?: Record<string, unknown>;
  ipAddress?: string;
  userAgent?: string;
}

export interface ListAuditLogFilters {
  companyId: string;
  entityType?: string;
  entityId?: string;
  action?: string;
  take?: number;
  skip?: number;
}

/**
 * Puerto de auditoria. IMPORTANTE: a proposito NO expone update()/delete() -- los registros
 * de auditoria son inmutables por diseño de codigo ("los registros NO podran eliminarse").
 */
export interface IAuditLogRepository {
  create(input: CreateAuditLogInput): Promise<AuditLogEntry>;
  list(filters: ListAuditLogFilters): Promise<AuditLogEntry[]>;
}
