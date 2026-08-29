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
  ISubscriptionRepository,
  SaasDashboardStats,
  SavePaymentSourceData,
  SubscriptionDueForAutoCharge,
  SubscriptionForLifecycleCheck,
  SubscriptionPaymentRecord,
  SubscriptionRecord,
  SubscriptionWithDetails,
} from "../../domain/subscription.repository";
import { SavePaymentSourceUseCase } from "./save-payment-source.use-case";

function makeSubscription(overrides: Partial<SubscriptionRecord> = {}): SubscriptionRecord {
  return {
    id: "sub-1",
    companyId: "company-1",
    planId: "plan-1",
    status: "ACTIVE",
    billingCycle: "MONTHLY",
    startDate: new Date("2026-01-01"),
    currentPeriodEnd: new Date("2026-08-08"),
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

class FakeSubscriptionRepository implements ISubscriptionRepository {
  subscription: SubscriptionRecord | null = null;
  saved: { id: string; data: SavePaymentSourceData } | null = null;

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
  async createPendingPayment(): Promise<SubscriptionPaymentRecord> {
    throw new Error("not implemented");
  }
  async findPaymentByReference(): Promise<SubscriptionPaymentRecord | null> {
    throw new Error("not implemented");
  }
  async confirmPayment(): Promise<ApplyPaymentResult> {
    throw new Error("not implemented");
  }
  async failPayment(): Promise<SubscriptionPaymentRecord> {
    throw new Error("not implemented");
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
  async savePaymentSource(id: string, data: SavePaymentSourceData): Promise<SubscriptionRecord> {
    this.saved = { id, data };
    this.subscription = {
      ...this.subscription!,
      autoRenew: true,
      wompiPaymentSourceId: data.wompiPaymentSourceId,
      cardLastFour: data.cardLastFour,
      cardBrand: data.cardBrand,
    };
    return this.subscription;
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
  lastInput: CreatePaymentSourceInput | null = null;
  result: WompiPaymentSource = { paymentSourceId: "ps-1", cardLastFour: "4242", cardBrand: "VISA" };
  buildCheckoutUrl(_input: CreateCheckoutInput): WompiCheckoutLink {
    throw new Error("not implemented");
  }
  verifyWebhookSignature(_event: WompiWebhookEvent): boolean {
    throw new Error("not implemented");
  }
  async createPaymentSource(input: CreatePaymentSourceInput): Promise<WompiPaymentSource> {
    this.lastInput = input;
    return this.result;
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
  const useCase = new SavePaymentSourceUseCase(subscriptionRepo, paymentGateway, new AuditService(auditRepo));
  return { useCase, subscriptionRepo, paymentGateway, auditRepo };
}

describe("SavePaymentSourceUseCase", () => {
  it("tokeniza contra Wompi, guarda la payment_source y activa autoRenew", async () => {
    const { useCase, subscriptionRepo, paymentGateway } = makeUseCase();
    subscriptionRepo.subscription = makeSubscription();

    const result = await useCase.execute({
      subscriptionId: "sub-1",
      cardToken: "tok_test_123",
      customerEmail: "cliente@demo.com",
      acceptanceToken: "acc_token_123",
    });

    expect(paymentGateway.lastInput).toEqual({
      cardToken: "tok_test_123",
      customerEmail: "cliente@demo.com",
      acceptanceToken: "acc_token_123",
    });
    expect(result.autoRenew).toBe(true);
    expect(result.wompiPaymentSourceId).toBe("ps-1");
    expect(result.cardLastFour).toBe("4242");
    expect(subscriptionRepo.saved?.id).toBe("sub-1");
  });

  it("audita SUBSCRIPTION_AUTO_RENEW_ENABLED con el companyId de la suscripcion", async () => {
    const { useCase, subscriptionRepo, auditRepo } = makeUseCase();
    subscriptionRepo.subscription = makeSubscription({ companyId: "company-42" });

    await useCase.execute({
      subscriptionId: "sub-1",
      cardToken: "tok_test_123",
      customerEmail: "cliente@demo.com",
      acceptanceToken: "acc_token_123",
    });

    const entry = auditRepo.entries.find((e) => e.action === "SUBSCRIPTION_AUTO_RENEW_ENABLED");
    expect(entry).toBeDefined();
    expect(entry?.entityId).toBe("sub-1");
  });

  it("no guarda nada si Wompi rechaza la tokenizacion", async () => {
    const { useCase, subscriptionRepo, paymentGateway } = makeUseCase();
    subscriptionRepo.subscription = makeSubscription();
    paymentGateway.createPaymentSource = async () => {
      throw new Error("Wompi rechazo la solicitud: tarjeta invalida");
    };

    await expect(
      useCase.execute({ subscriptionId: "sub-1", cardToken: "bad", customerEmail: "a@b.com", acceptanceToken: "x" })
    ).rejects.toThrow(/tarjeta invalida/);
    expect(subscriptionRepo.saved).toBeNull();
  });
});
