import { describe, expect, it } from "vitest";
import { AuditService } from "../../../audit/application/audit.service";
import type { AuditLogEntry, CreateAuditLogInput, IAuditLogRepository } from "../../../audit/domain/audit-log.repository";
import type {
  ChargePaymentSourceInput,
  CreateCheckoutInput,
  CreatePaymentSourceInput,
  IPaymentGateway,
  WompiChargeResult,
  WompiCheckoutLink,
  WompiPaymentSource,
  WompiWebhookEvent,
} from "../../domain/payment-gateway";
import type {
  ApplyPaymentResult,
  CompanyWithSubscriptionRecord,
  CreatePendingPaymentData,
  ISubscriptionRepository,
  SaasDashboardStats,
  SubscriptionDueForAutoCharge,
  SubscriptionForLifecycleCheck,
  SubscriptionPaymentRecord,
  SubscriptionRecord,
  SubscriptionWithDetails,
} from "../../domain/subscription.repository";
import { RunSubscriptionAutoChargesUseCase } from "./run-subscription-auto-charges.use-case";

function makeDue(overrides: Partial<SubscriptionDueForAutoCharge> = {}): SubscriptionDueForAutoCharge {
  return {
    id: "sub-1",
    companyId: "company-1",
    companyEmail: "cliente@demo.com",
    planId: "plan-1",
    planPriceMonthly: 79900,
    planPriceYearly: 862900,
    status: "ACTIVE",
    billingCycle: "MONTHLY",
    startDate: new Date("2026-01-01"),
    currentPeriodEnd: new Date("2026-08-08"),
    graceEndsAt: null,
    cancelledAt: null,
    createdAt: new Date("2026-01-01"),
    autoRenew: true,
    wompiPaymentSourceId: "ps-1",
    cardLastFour: "4242",
    cardBrand: "VISA",
    ...overrides,
  };
}

class FakeSubscriptionRepository implements ISubscriptionRepository {
  due: SubscriptionDueForAutoCharge[] = [];
  attemptedToday = new Set<string>();
  pendingPayments: CreatePendingPaymentData[] = [];
  failedPaymentIds: string[] = [];
  private paymentsByReference = new Map<string, SubscriptionPaymentRecord>();

  async create(): Promise<SubscriptionRecord> {
    throw new Error("not implemented");
  }
  async findByIdOrThrow(): Promise<SubscriptionRecord> {
    throw new Error("not implemented");
  }
  async findActiveByCompanyId(): Promise<SubscriptionRecord | null> {
    throw new Error("not implemented");
  }
  async findLatestByCompanyId(): Promise<SubscriptionRecord | null> {
    throw new Error("not implemented");
  }
  async updatePlan(): Promise<SubscriptionRecord> {
    throw new Error("not implemented");
  }
  async list(): Promise<SubscriptionWithDetails[]> {
    throw new Error("not implemented");
  }
  async updateStatus(): Promise<SubscriptionRecord> {
    throw new Error("not implemented");
  }
  async applyPayment(): Promise<ApplyPaymentResult> {
    throw new Error("not implemented");
  }
  async createPendingPayment(data: CreatePendingPaymentData): Promise<SubscriptionPaymentRecord> {
    this.pendingPayments.push(data);
    const payment: SubscriptionPaymentRecord = {
      id: `payment-${this.pendingPayments.length}`,
      subscriptionId: data.subscriptionId,
      amount: data.amount,
      method: data.method,
      reference: data.reference,
      status: "PENDING",
      paidAt: null,
      createdAt: new Date(),
    };
    this.paymentsByReference.set(data.reference, payment);
    return payment;
  }
  async findPaymentByReference(reference: string): Promise<SubscriptionPaymentRecord | null> {
    return this.paymentsByReference.get(reference) ?? null;
  }
  async confirmPayment(): Promise<ApplyPaymentResult> {
    throw new Error("not implemented");
  }
  async failPayment(paymentId: string): Promise<SubscriptionPaymentRecord> {
    this.failedPaymentIds.push(paymentId);
    const payment = [...this.paymentsByReference.values()].find((p) => p.id === paymentId)!;
    payment.status = "FAILED";
    return payment;
  }
  async listForLifecycleCheck(): Promise<SubscriptionForLifecycleCheck[]> {
    throw new Error("not implemented");
  }
  async hasReminderLog(): Promise<boolean> {
    throw new Error("not implemented");
  }
  async createReminderLog(): Promise<void> {
    throw new Error("not implemented");
  }
  async listCompaniesWithSubscription(): Promise<CompanyWithSubscriptionRecord[]> {
    throw new Error("not implemented");
  }
  async getDashboardStats(): Promise<SaasDashboardStats> {
    throw new Error("not implemented");
  }
  async savePaymentSource(): Promise<SubscriptionRecord> {
    throw new Error("not implemented");
  }
  async disableAutoRenew(): Promise<SubscriptionRecord> {
    throw new Error("not implemented");
  }
  async listDueForAutoCharge(): Promise<SubscriptionDueForAutoCharge[]> {
    return this.due;
  }
  async hasAutoChargeAttemptSince(subscriptionId: string): Promise<boolean> {
    return this.attemptedToday.has(subscriptionId);
  }
}

class FakePaymentGateway implements IPaymentGateway {
  charges: ChargePaymentSourceInput[] = [];
  shouldThrow: string | null = null;

  buildCheckoutUrl(_input: CreateCheckoutInput): WompiCheckoutLink {
    throw new Error("not implemented");
  }
  verifyWebhookSignature(_event: WompiWebhookEvent): boolean {
    throw new Error("not implemented");
  }
  async createPaymentSource(_input: CreatePaymentSourceInput): Promise<WompiPaymentSource> {
    throw new Error("not implemented");
  }
  async chargePaymentSource(input: ChargePaymentSourceInput): Promise<WompiChargeResult> {
    this.charges.push(input);
    if (this.shouldThrow) throw new Error(this.shouldThrow);
    return { transactionId: "tx-1", status: "PENDING" };
  }
}

class FakeAuditLogRepository implements IAuditLogRepository {
  entries: CreateAuditLogInput[] = [];
  async create(input: CreateAuditLogInput): Promise<AuditLogEntry> {
    this.entries.push(input);
    return { id: `audit-${this.entries.length}`, metadata: input.metadata ?? null, createdAt: new Date(), ...input };
  }
  async list(): Promise<AuditLogEntry[]> {
    return [];
  }
}

function makeUseCase() {
  const subscriptionRepo = new FakeSubscriptionRepository();
  const paymentGateway = new FakePaymentGateway();
  const auditRepo = new FakeAuditLogRepository();
  const useCase = new RunSubscriptionAutoChargesUseCase(subscriptionRepo, paymentGateway, new AuditService(auditRepo));
  return { useCase, subscriptionRepo, paymentGateway, auditRepo };
}

describe("RunSubscriptionAutoChargesUseCase", () => {
  it("cobra una suscripcion mensual vencida con payment_source guardada", async () => {
    const { useCase, subscriptionRepo, paymentGateway } = makeUseCase();
    subscriptionRepo.due = [makeDue()];

    await useCase.execute();

    expect(paymentGateway.charges).toHaveLength(1);
    expect(paymentGateway.charges[0]).toMatchObject({
      amountInCents: 7990000,
      customerEmail: "cliente@demo.com",
      paymentSourceId: "ps-1",
    });
    expect(subscriptionRepo.pendingPayments).toHaveLength(1);
    expect(subscriptionRepo.pendingPayments[0].method).toBe("WOMPI_AUTO");
    // No confirma el pago -- eso lo hace el webhook via ConfirmWompiPaymentUseCase.
    expect(subscriptionRepo.failedPaymentIds).toHaveLength(0);
  });

  it("usa el precio anual cuando billingCycle es YEARLY", async () => {
    const { useCase, subscriptionRepo, paymentGateway } = makeUseCase();
    subscriptionRepo.due = [makeDue({ billingCycle: "YEARLY" })];

    await useCase.execute();

    expect(paymentGateway.charges[0].amountInCents).toBe(86290000);
  });

  it("no cobra si ya se intento hoy (evita reintentar cada hora tras un DECLINED)", async () => {
    const { useCase, subscriptionRepo, paymentGateway } = makeUseCase();
    subscriptionRepo.due = [makeDue()];
    subscriptionRepo.attemptedToday.add("sub-1");

    await useCase.execute();

    expect(paymentGateway.charges).toHaveLength(0);
    expect(subscriptionRepo.pendingPayments).toHaveLength(0);
  });

  it("salta suscripciones sin payment_source guardada (no deberian estar en autoRenew sin una, pero por si acaso)", async () => {
    const { useCase, subscriptionRepo, paymentGateway } = makeUseCase();
    subscriptionRepo.due = [makeDue({ wompiPaymentSourceId: null })];

    await useCase.execute();

    expect(paymentGateway.charges).toHaveLength(0);
  });

  it("si Wompi falla sincronicamente, marca el pago FAILED y audita, sin tumbar el resto del batch", async () => {
    const { useCase, subscriptionRepo, paymentGateway, auditRepo } = makeUseCase();
    subscriptionRepo.due = [makeDue({ id: "sub-1" }), makeDue({ id: "sub-2", companyId: "company-2" })];
    paymentGateway.shouldThrow = "Wompi rechazo la solicitud: tarjeta rechazada";

    await useCase.execute();

    expect(paymentGateway.charges).toHaveLength(2);
    expect(subscriptionRepo.failedPaymentIds).toHaveLength(2);
    const failures = auditRepo.entries.filter((e) => e.action === "SUBSCRIPTION_AUTO_CHARGE_FAILED");
    expect(failures).toHaveLength(2);
    expect(failures[0].description).toContain("tarjeta rechazada");
  });
});
