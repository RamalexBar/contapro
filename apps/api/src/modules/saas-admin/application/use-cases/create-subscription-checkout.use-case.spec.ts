import { describe, expect, it } from "vitest";
import type { CreatePlanData, IPlanRepository, PlanRecord, UpdatePlanData } from "../../domain/plan.repository";
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
  SubscriptionStatus,
  SubscriptionWithDetails,
} from "../../domain/subscription.repository";
import { CreateSubscriptionCheckoutUseCase } from "./create-subscription-checkout.use-case";

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

function makePlan(overrides: Partial<PlanRecord> = {}): PlanRecord {
  return {
    id: "plan-1",
    code: "PYME",
    name: "Plan Pyme",
    priceMonthly: 79900,
    priceYearly: 862900,
    maxBranches: 3,
    maxUsers: 10,
    features: {},
    isActive: true,
    createdAt: new Date("2026-01-01"),
    ...overrides,
  };
}

class FakeSubscriptionRepository implements ISubscriptionRepository {
  subscription: SubscriptionRecord | null = null;
  pendingPayments: CreatePendingPaymentData[] = [];

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
  async createPendingPayment(data: CreatePendingPaymentData): Promise<SubscriptionPaymentRecord> {
    this.pendingPayments.push(data);
    return {
      id: `payment-${this.pendingPayments.length}`,
      subscriptionId: data.subscriptionId,
      amount: data.amount,
      method: data.method,
      reference: data.reference,
      status: "PENDING",
      paidAt: null,
      createdAt: new Date(),
    };
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

class FakePlanRepository implements IPlanRepository {
  plan: PlanRecord | null = null;
  async create(): Promise<PlanRecord> {
    throw new Error("not implemented");
  }
  async list(): Promise<PlanRecord[]> {
    throw new Error("not implemented");
  }
  async update(): Promise<PlanRecord> {
    throw new Error("not implemented");
  }
  async findByIdOrThrow(): Promise<PlanRecord> {
    if (!this.plan) throw new Error("not found");
    return this.plan;
  }
  async findByCode(): Promise<PlanRecord | null> {
    throw new Error("not implemented");
  }
}

class FakePaymentGateway implements IPaymentGateway {
  lastInput: CreateCheckoutInput | null = null;
  buildCheckoutUrl(input: CreateCheckoutInput): WompiCheckoutLink {
    this.lastInput = input;
    return { checkoutUrl: `https://checkout.wompi.co/p/?reference=${input.reference}` };
  }
  verifyWebhookSignature(_event: WompiWebhookEvent): boolean {
    throw new Error("not implemented");
  }
  async createPaymentSource(_input: CreatePaymentSourceInput): Promise<WompiPaymentSource> {
    throw new Error("not implemented");
  }
  async chargePaymentSource(_input: ChargePaymentSourceInput): Promise<WompiChargeResult> {
    throw new Error("not implemented");
  }
}

function makeUseCase() {
  const subscriptionRepo = new FakeSubscriptionRepository();
  const planRepo = new FakePlanRepository();
  const paymentGateway = new FakePaymentGateway();
  const useCase = new CreateSubscriptionCheckoutUseCase(subscriptionRepo, planRepo, paymentGateway);
  return { useCase, subscriptionRepo, planRepo, paymentGateway };
}

describe("CreateSubscriptionCheckoutUseCase", () => {
  it("usa el precio mensual del plan cuando billingCycle es MONTHLY", async () => {
    const { useCase, subscriptionRepo, planRepo, paymentGateway } = makeUseCase();
    subscriptionRepo.subscription = makeSubscription({ billingCycle: "MONTHLY" });
    planRepo.plan = makePlan({ priceMonthly: 79900, priceYearly: 862900 });

    const result = await useCase.execute({ subscriptionId: "sub-1", customerEmail: "cliente@demo.com" });

    expect(result.amount).toBe(79900);
    expect(paymentGateway.lastInput?.amountInCents).toBe(7990000);
    expect(subscriptionRepo.pendingPayments).toEqual([
      expect.objectContaining({ subscriptionId: "sub-1", amount: 79900, method: "WOMPI" }),
    ]);
  });

  it("usa el precio anual del plan cuando billingCycle es YEARLY", async () => {
    const { useCase, subscriptionRepo, planRepo } = makeUseCase();
    subscriptionRepo.subscription = makeSubscription({ billingCycle: "YEARLY" });
    planRepo.plan = makePlan({ priceMonthly: 79900, priceYearly: 862900 });

    const result = await useCase.execute({ subscriptionId: "sub-1", customerEmail: "cliente@demo.com" });

    expect(result.amount).toBe(862900);
  });

  it("rechaza generar un cobro para un plan sin costo (ej. TRIAL)", async () => {
    const { useCase, subscriptionRepo, planRepo } = makeUseCase();
    subscriptionRepo.subscription = makeSubscription();
    planRepo.plan = makePlan({ priceMonthly: 0, priceYearly: 0 });

    await expect(useCase.execute({ subscriptionId: "sub-1", customerEmail: "cliente@demo.com" })).rejects.toThrow(
      /no tiene costo/
    );
  });

  it("genera una reference distinta en cada llamada (permite reintentos)", async () => {
    const { useCase, subscriptionRepo, planRepo } = makeUseCase();
    subscriptionRepo.subscription = makeSubscription();
    planRepo.plan = makePlan();

    const first = await useCase.execute({ subscriptionId: "sub-1", customerEmail: "a@b.com" });
    const second = await useCase.execute({ subscriptionId: "sub-1", customerEmail: "a@b.com" });

    expect(first.reference).not.toBe(second.reference);
  });
});
