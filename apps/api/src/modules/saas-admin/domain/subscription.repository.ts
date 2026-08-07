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

export interface SubscriptionForLifecycleCheck extends SubscriptionRecord {
  companyName: string;
  companyEmail: string;
  // Item 41 de docs/ALCANCE.md (recordatorio por WhatsApp con fallback a email): null si la
  // empresa no registro telefono.
  companyPhone: string | null;
  planName: string;
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

export interface CreatePendingPaymentData {
  subscriptionId: string;
  amount: number;
  method: string;
  /** Unico por INTENTO de cobro (no por suscripcion) -- permite reintentar si un intento anterior
   * quedo DECLINED/expirado sin chocar con ningun constraint. Es el valor que se manda a Wompi
   * como `reference` y que el webhook devuelve identico, sirve para correlacionar la respuesta. */
  reference: string;
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
  /** A diferencia de findActiveByCompanyId (filtra a TRIALING/ACTIVE/GRACE_PERIOD), esta trae la
   * suscripcion mas reciente sin importar el status -- usado por la pantalla de "Mi suscripcion"
   * (modules/billing) para poder mostrarle a la empresa que esta SUSPENDED/CANCELLED en vez de un
   * 404 confuso cuando ya no tiene ninguna "activa". */
  findLatestByCompanyId(companyId: string): Promise<SubscriptionRecord | null>;
  /** Cambia el plan asignado a una suscripcion sin tocar status/currentPeriodEnd -- usado cuando
   * una empresa en TRIAL elige por primera vez un plan pago, antes de generar el checkout para
   * ese plan (modules/billing). No cobra nada por si solo. */
  updatePlan(subscriptionId: string, planId: string): Promise<SubscriptionRecord>;
  list(filter?: { status?: SubscriptionStatus }): Promise<SubscriptionWithDetails[]>;
  updateStatus(id: string, status: SubscriptionStatus, graceEndsAt?: Date | null): Promise<SubscriptionRecord>;
  /** Crea el SubscriptionPayment (status CONFIRMED), actualiza currentPeriodEnd, limpia
   * graceEndsAt, vuelve el status a ACTIVE -- todo en una transaccion. Usado por el registro
   * MANUAL de un pago (RegisterSubscriptionPaymentUseCase, plataforma confirma "esto ya se
   * pago"). El flujo Wompi usa createPendingPayment + confirmPayment/failPayment en cambio,
   * porque ahi el pago no esta confirmado hasta que el webhook lo dice. */
  applyPayment(id: string, data: ApplyPaymentData): Promise<ApplyPaymentResult>;
  /** Crea un SubscriptionPayment en PENDING -- usado al generar un link de cobro Wompi, antes de
   * saber si el cliente efectivamente paga. */
  createPendingPayment(data: CreatePendingPaymentData): Promise<SubscriptionPaymentRecord>;
  findPaymentByReference(reference: string): Promise<SubscriptionPaymentRecord | null>;
  /** Confirma un pago PENDING ya existente (por id, no crea uno nuevo): CONFIRMED + paidAt, y
   * aplica el mismo efecto que applyPayment sobre la suscripcion (currentPeriodEnd, graceEndsAt,
   * status ACTIVE) en una sola transaccion. */
  confirmPayment(paymentId: string, newPeriodEnd: Date): Promise<ApplyPaymentResult>;
  /** Marca un pago PENDING como FAILED -- no toca la suscripcion (queda como estaba). */
  failPayment(paymentId: string): Promise<SubscriptionPaymentRecord>;
  /** Usado por RunSubscriptionLifecycleUseCase -- suscripciones en estados que necesitan
   * revision diaria (TRIALING/ACTIVE/GRACE_PERIOD; SUSPENDED/CANCELLED ya no cambian solas).
   * Incluye datos de empresa/plan (companyName/companyEmail/planName) porque el recordatorio
   * real (IReminderNotifier) los necesita para armar el mensaje. */
  listForLifecycleCheck(): Promise<SubscriptionForLifecycleCheck[]>;
  /** @@unique([subscriptionId, daysBeforeDue]) evita duplicados a nivel DB, pero se consulta
   * antes para no depender de capturar el error de duplicado. */
  hasReminderLog(subscriptionId: string, daysBeforeDue: number): Promise<boolean>;
  createReminderLog(subscriptionId: string, daysBeforeDue: number, channel: string): Promise<void>;
  /** Todas las Company con su suscripcion mas reciente (si tiene alguna) -- para la vista
   * GET /admin/companies. */
  listCompaniesWithSubscription(): Promise<CompanyWithSubscriptionRecord[]>;
  getDashboardStats(): Promise<SaasDashboardStats>;
}
