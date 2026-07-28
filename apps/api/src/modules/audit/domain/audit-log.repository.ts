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
  | "PAYROLL_PARAMETER_CREATED"
  | "PAYROLL_CREATED"
  | "PAYROLL_CALCULATED"
  | "PAYROLL_APPROVED"
  | "PAYROLL_PAID";

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
