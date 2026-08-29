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
import { ConfirmWompiPaymentUseCase } from "./confirm-wompi-payment.use-case";

function makeSubscription(overrides: Partial<SubscriptionRecord> = {}): SubscriptionRecord {
  return {
    id: "sub-1",
    companyId: "company-1",
    planId: "plan-1",
    status: "ACTIVE",
    billingCycle: "MONTHLY",
    startDate: new Date("2026-01-01"),
    currentPeriodEnd: new Date("2026-08-08T00:00:00.000Z"),
    graceEndsAt: null,
    cancelledAt: null,
    createdAt: new Date("2026-01-01"),
    autoRenew: false,
    wompiPaymentSourceId: null,
    cardLastFour: null,
    cardBrand: null,
    ...overrides,
  };
}

function makePayment(overrides: Partial<SubscriptionPaymentRecord> = {}): SubscriptionPaymentRecord {
  return {
    id: "payment-1",
    subscriptionId: "sub-1",
    amount: 79900,
    method: "WOMPI",
    reference: "sub-1-1234-abcd1234",
    status: "PENDING",
    paidAt: null,
    createdAt: new Date("2026-08-01"),
    ...overrides,
  };
}

function makeEvent(overrides: Partial<WompiWebhookEvent> = {}): WompiWebhookEvent {
  return {
    event: "transaction.updated",
    data: { transaction: { id: "tx-1", status: "APPROVED", reference: "sub-1-1234-abcd1234", amount_in_cents: 7990000 } },
    environment: "test",
    timestamp: 1530291411,
    signature: { properties: ["transaction.id"], checksum: "whatever" },
    ...overrides,
  };
}

class FakeSubscriptionRepository implements ISubscriptionRepository {
  subscription: SubscriptionRecord | null = null;
  payment: SubscriptionPaymentRecord | null = null;
  confirmed: Array<{ paymentId: string; newPeriodEnd: Date }> = [];
  failed: string[] = [];

  async create(): Promise<SubscriptionRecord> {
    throw new Error("not implemented");
  }
  async findByIdOrThrow(): Promise<SubscriptionRecord> {
    if (!this.subscription) throw new Error("not found");
    return this.subscription;
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
  async createPendingPayment(_data: CreatePendingPaymentData): Promise<SubscriptionPaymentRecord> {
    throw new Error("not implemented");
  }
  async findPaymentByReference(reference: string): Promise<SubscriptionPaymentRecord | null> {
    return this.payment && this.payment.reference === reference ? this.payment : null;
  }
  async confirmPayment(paymentId: string, newPeriodEnd: Date): Promise<ApplyPaymentResult> {
    this.confirmed.push({ paymentId, newPeriodEnd });
    if (this.payment) this.payment.status = "CONFIRMED";
    return {
      subscription: { ...this.subscription!, status: "ACTIVE", currentPeriodEnd: newPeriodEnd, graceEndsAt: null },
      payment: { ...this.payment!, status: "CONFIRMED", paidAt: new Date() },
    };
  }
  async failPayment(paymentId: string): Promise<SubscriptionPaymentRecord> {
    this.failed.push(paymentId);
    if (this.payment) this.payment.status = "FAILED";
    return { ...this.payment!, status: "FAILED" };
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
    throw new Error("not implemented");
  }
  async hasAutoChargeAttemptSince(): Promise<boolean> {
    throw new Error("not implemented");
  }
}

class FakePaymentGateway implements IPaymentGateway {
  shouldVerify = true;
  buildCheckoutUrl(_input: CreateCheckoutInput): WompiCheckoutLink {
    throw new Error("not implemented");
  }
  verifyWebhookSignature(_event: WompiWebhookEvent): boolean {
    return this.shouldVerify;
  }
  async createPaymentSource(_input: CreatePaymentSourceInput): Promise<WompiPaymentSource> {
    throw new Error("not implemented");
  }
  async chargePaymentSource(_input: ChargePaymentSourceInput): Promise<WompiChargeResult> {
    throw new Error("not implemented");
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
  const useCase = new ConfirmWompiPaymentUseCase(subscriptionRepo, paymentGateway, new AuditService(auditRepo));
  return { useCase, subscriptionRepo, paymentGateway, auditRepo };
}

describe("ConfirmWompiPaymentUseCase", () => {
  it("ignora el evento si la firma no verifica -- no toca nada", async () => {
    const { useCase, subscriptionRepo, paymentGateway } = makeUseCase();
    subscriptionRepo.subscription = makeSubscription();
    subscriptionRepo.payment = makePayment();
    paymentGateway.shouldVerify = false;

    await useCase.execute(makeEvent());

    expect(subscriptionRepo.confirmed).toHaveLength(0);
    expect(subscriptionRepo.failed).toHaveLength(0);
  });

  it("ignora eventos que no son transaction.updated", async () => {
    const { useCase, subscriptionRepo } = makeUseCase();
    subscriptionRepo.subscription = makeSubscription();
    subscriptionRepo.payment = makePayment();

    await useCase.execute(makeEvent({ event: "nomination_updated" }));

    expect(subscriptionRepo.confirmed).toHaveLength(0);
  });

  it("ignora el evento si no encuentra un pago PENDING con esa reference", async () => {
    const { useCase, subscriptionRepo } = makeUseCase();
    subscriptionRepo.subscription = makeSubscription();
    subscriptionRepo.payment = null;

    await useCase.execute(makeEvent());

    expect(subscriptionRepo.confirmed).toHaveLength(0);
  });

  it("ignora el evento si el pago encontrado ya no esta PENDING (evita doble aplicacion)", async () => {
    const { useCase, subscriptionRepo } = makeUseCase();
    subscriptionRepo.subscription = makeSubscription();
    subscriptionRepo.payment = makePayment({ status: "CONFIRMED" });

    await useCase.execute(makeEvent());

    expect(subscriptionRepo.confirmed).toHaveLength(0);
  });

  it("APPROVED: confirma el pago y calcula el nuevo vencimiento desde currentPeriodEnd original", async () => {
    const { useCase, subscriptionRepo, auditRepo } = makeUseCase();
    subscriptionRepo.subscription = makeSubscription({ billingCycle: "MONTHLY", currentPeriodEnd: new Date("2026-08-08T00:00:00.000Z") });
    subscriptionRepo.payment = makePayment();

    await useCase.execute(makeEvent({ data: { transaction: { id: "tx-1", status: "APPROVED", reference: "sub-1-1234-abcd1234", amount_in_cents: 7990000 } } }));

    expect(subscriptionRepo.confirmed).toEqual([
      { paymentId: "payment-1", newPeriodEnd: new Date("2026-09-08T00:00:00.000Z") },
    ]);
    expect(auditRepo.entries.some((e) => e.action === "SUBSCRIPTION_PAYMENT_REGISTERED")).toBe(true);
  });

  it("DECLINED: marca el pago como fallido, no toca la suscripcion", async () => {
    const { useCase, subscriptionRepo } = makeUseCase();
    subscriptionRepo.subscription = makeSubscription();
    subscriptionRepo.payment = makePayment();

    await useCase.execute(makeEvent({ data: { transaction: { id: "tx-1", status: "DECLINED", reference: "sub-1-1234-abcd1234", amount_in_cents: 7990000 } } }));

    expect(subscriptionRepo.failed).toEqual(["payment-1"]);
    expect(subscriptionRepo.confirmed).toHaveLength(0);
  });

  it("PENDING: no hace nada, se espera el proximo evento", async () => {
    const { useCase, subscriptionRepo } = makeUseCase();
    subscriptionRepo.subscription = makeSubscription();
    subscriptionRepo.payment = makePayment();

    await useCase.execute(makeEvent({ data: { transaction: { id: "tx-1", status: "PENDING", reference: "sub-1-1234-abcd1234", amount_in_cents: 7990000 } } }));

    expect(subscriptionRepo.confirmed).toHaveLength(0);
    expect(subscriptionRepo.failed).toHaveLength(0);
  });
});
