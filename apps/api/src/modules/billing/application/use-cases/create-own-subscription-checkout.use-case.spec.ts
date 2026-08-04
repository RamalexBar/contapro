import { describe, expect, it } from "vitest";
import { tenantStorage } from "../../../../shared/context/request-context";
import type { CreateCheckoutInput, IPaymentGateway, WompiCheckoutLink, WompiWebhookEvent } from "../../../saas-admin/domain/payment-gateway";
import type { IPlanRepository, PlanRecord } from "../../../saas-admin/domain/plan.repository";
import type {
  ApplyPaymentResult,
  CompanyWithSubscriptionRecord,
  CreatePendingPaymentData,
  ISubscriptionRepository,
  SaasDashboardStats,
  SubscriptionForLifecycleCheck,
  SubscriptionPaymentRecord,
  SubscriptionRecord,
  SubscriptionWithDetails,
} from "../../../saas-admin/domain/subscription.repository";
import { CreateSubscriptionCheckoutUseCase } from "../../../saas-admin/application/use-cases/create-subscription-checkout.use-case";
import { CreateOwnSubscriptionCheckoutUseCase } from "./create-own-subscription-checkout.use-case";

function makeSubscription(overrides: Partial<SubscriptionRecord> = {}): SubscriptionRecord {
  return {
    id: "sub-1",
    companyId: "company-1",
    planId: "plan-trial",
    status: "TRIALING",
    billingCycle: "MONTHLY",
    startDate: new Date("2026-01-01"),
    currentPeriodEnd: new Date("2026-08-08"),
    graceEndsAt: null,
    cancelledAt: null,
    createdAt: new Date("2026-01-01"),
    ...overrides,
  };
}

function makePlan(overrides: Partial<PlanRecord> = {}): PlanRecord {
  return {
    id: "plan-trial",
    code: "TRIAL",
    name: "Prueba gratuita",
    priceMonthly: 0,
    priceYearly: 0,
    maxBranches: 1,
    maxUsers: 3,
    features: {},
    isActive: true,
    createdAt: new Date("2026-01-01"),
    ...overrides,
  };
}

class FakeSubscriptionRepository implements ISubscriptionRepository {
  subscription: SubscriptionRecord | null = null;
  planUpdates: Array<{ subscriptionId: string; planId: string }> = [];

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
  async findLatestByCompanyId(companyId: string): Promise<SubscriptionRecord | null> {
    return this.subscription && this.subscription.companyId === companyId ? this.subscription : null;
  }
  async updatePlan(subscriptionId: string, planId: string): Promise<SubscriptionRecord> {
    this.planUpdates.push({ subscriptionId, planId });
    if (this.subscription) this.subscription = { ...this.subscription, planId };
    return this.subscription!;
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
    return {
      id: "payment-1",
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
}

class FakePlanRepository implements IPlanRepository {
  plans: PlanRecord[] = [];
  async create(): Promise<PlanRecord> {
    throw new Error("not implemented");
  }
  async list(): Promise<PlanRecord[]> {
    return this.plans;
  }
  async update(): Promise<PlanRecord> {
    throw new Error("not implemented");
  }
  async findByIdOrThrow(id: string): Promise<PlanRecord> {
    const plan = this.plans.find((p) => p.id === id);
    if (!plan) throw new Error("not found");
    return plan;
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
}

function withTenantContext<T>(fn: () => Promise<T>): Promise<T> {
  return tenantStorage.run({ companyId: "company-1", branchId: null, userId: "user-1", roles: [], permissions: new Set() }, fn);
}

function makeUseCase() {
  const subscriptionRepo = new FakeSubscriptionRepository();
  const planRepo = new FakePlanRepository();
  const paymentGateway = new FakePaymentGateway();
  // AuditService no se usa dentro de CreateSubscriptionCheckoutUseCase (no audita, solo crea el
  // pending payment) -- no hace falta instanciarlo aqui, el constructor real no lo pide.
  const createCheckout = new CreateSubscriptionCheckoutUseCase(subscriptionRepo, planRepo, paymentGateway);
  const useCase = new CreateOwnSubscriptionCheckoutUseCase(subscriptionRepo, planRepo, createCheckout);
  return { useCase, subscriptionRepo, planRepo, paymentGateway };
}

describe("CreateOwnSubscriptionCheckoutUseCase", () => {
  it("genera el checkout para la suscripcion propia sin cambiar de plan", async () => {
    const { useCase, subscriptionRepo, planRepo, paymentGateway } = makeUseCase();
    subscriptionRepo.subscription = makeSubscription({ planId: "plan-basico", billingCycle: "MONTHLY" });
    planRepo.plans = [makePlan({ id: "plan-basico", code: "BASICO", priceMonthly: 39900 })];

    const result = await withTenantContext(() => useCase.execute({ customerEmail: "a@b.com" }));

    expect(result.amount).toBe(39900);
    expect(subscriptionRepo.planUpdates).toHaveLength(0);
    expect(paymentGateway.lastInput?.reference).toContain("sub-1");
  });

  it("cambia de plan antes de generar el checkout si se pide un planId distinto", async () => {
    const { useCase, subscriptionRepo, planRepo } = makeUseCase();
    subscriptionRepo.subscription = makeSubscription({ planId: "plan-trial" });
    planRepo.plans = [makePlan({ id: "plan-trial", code: "TRIAL" }), makePlan({ id: "plan-pyme", code: "PYME", priceMonthly: 79900 })];

    const result = await withTenantContext(() => useCase.execute({ customerEmail: "a@b.com", planId: "plan-pyme" }));

    expect(subscriptionRepo.planUpdates).toEqual([{ subscriptionId: "sub-1", planId: "plan-pyme" }]);
    expect(result.amount).toBe(79900);
  });

  it("no llama a updatePlan si planId es el mismo que ya tiene", async () => {
    const { useCase, subscriptionRepo, planRepo } = makeUseCase();
    subscriptionRepo.subscription = makeSubscription({ planId: "plan-basico" });
    planRepo.plans = [makePlan({ id: "plan-basico", code: "BASICO", priceMonthly: 39900 })];

    await withTenantContext(() => useCase.execute({ customerEmail: "a@b.com", planId: "plan-basico" }));

    expect(subscriptionRepo.planUpdates).toHaveLength(0);
  });

  it("rechaza cambiar a un plan TRIAL", async () => {
    const { useCase, subscriptionRepo, planRepo } = makeUseCase();
    subscriptionRepo.subscription = makeSubscription({ planId: "plan-basico" });
    planRepo.plans = [makePlan({ id: "plan-basico", code: "BASICO" }), makePlan({ id: "plan-trial", code: "TRIAL" })];

    await expect(withTenantContext(() => useCase.execute({ customerEmail: "a@b.com", planId: "plan-trial" }))).rejects.toThrow(
      /prueba/
    );
  });
});
