export type SubscriptionStatus = "TRIALING" | "ACTIVE" | "GRACE_PERIOD" | "SUSPENDED" | "CANCELLED";

export interface CreateSubscriptionData {
  companyId: string;
  planId: string;
  status: SubscriptionStatus;
  billingCycle: "MONTHLY" | "YEARLY";
  startDate: Date;
  currentPeriodEnd: Date;
}

export interface SubscriptionRecord {
  id: string;
  companyId: string;
  planId: string;
  status: SubscriptionStatus;
  billingCycle: string;
  startDate: Date;
  currentPeriodEnd: Date;
  graceEndsAt: Date | null;
  cancelledAt: Date | null;
  createdAt: Date;
}

export interface SubscriptionWithDetails extends SubscriptionRecord {
  companyName: string;
  planName: string;
  planCode: string;
}

export interface SubscriptionPaymentRecord {
  id: string;
  subscriptionId: string;
  amount: number;
  method: string;
  reference: string | null;
  status: string;
  paidAt: Date | null;
  createdAt: Date;
}

export interface ApplyPaymentData {
  amount: number;
  method: string;
  reference?: string;
  /** Ya calculado por el caso de uso via calculateNextPeriodEnd (packages/shared-utils/src/dates.ts)
   * -- este repo solo persiste, no decide la fecha. */
  newPeriodEnd: Date;
}

export interface ApplyPaymentResult {
  subscription: SubscriptionRecord;
  payment: SubscriptionPaymentRecord;
}

export interface CompanyWithSubscriptionRecord {
  companyId: string;
  companyName: string;
  nit: string;
  isActive: boolean;
  subscriptionStatus: SubscriptionStatus | null;
  planName: string | null;
  currentPeriodEnd: Date | null;
  graceEndsAt: Date | null;
}

export interface SaasDashboardStats {
  companiesByStatus: Record<SubscriptionStatus, number>;
  /** Suscripciones TRIALING/ACTIVE/GRACE_PERIOD que vencen en los proximos 8 dias. */
  upcomingRenewals: number;
  /** Suma de SubscriptionPayment.amount con status CONFIRMED y paidAt en el mes en curso. */
  monthlyRevenueConfirmed: number;
}

export interface ISubscriptionRepository {
  create(data: CreateSubscriptionData): Promise<SubscriptionRecord>;
  findByIdOrThrow(id: string): Promise<SubscriptionRecord>;
  findActiveByCompanyId(companyId: string): Promise<SubscriptionRecord | null>;
  list(filter?: { status?: SubscriptionStatus }): Promise<SubscriptionWithDetails[]>;
  updateStatus(id: string, status: SubscriptionStatus, graceEndsAt?: Date | null): Promise<SubscriptionRecord>;
  /** Crea el SubscriptionPayment (status CONFIRMED), actualiza currentPeriodEnd, limpia
   * graceEndsAt, vuelve el status a ACTIVE -- todo en una transaccion. */
  applyPayment(id: string, data: ApplyPaymentData): Promise<ApplyPaymentResult>;
  /** Usado por RunSubscriptionLifecycleUseCase -- suscripciones en estados que necesitan
   * revision diaria (TRIALING/ACTIVE/GRACE_PERIOD; SUSPENDED/CANCELLED ya no cambian solas). */
  listForLifecycleCheck(): Promise<SubscriptionRecord[]>;
  /** @@unique([subscriptionId, daysBeforeDue]) evita duplicados a nivel DB, pero se consulta
   * antes para no depender de capturar el error de duplicado. */
  hasReminderLog(subscriptionId: string, daysBeforeDue: number): Promise<boolean>;
  createReminderLog(subscriptionId: string, daysBeforeDue: number, channel: string): Promise<void>;
  /** Todas las Company con su suscripcion mas reciente (si tiene alguna) -- para la vista
   * GET /admin/companies. */
  listCompaniesWithSubscription(): Promise<CompanyWithSubscriptionRecord[]>;
  getDashboardStats(): Promise<SaasDashboardStats>;
}
