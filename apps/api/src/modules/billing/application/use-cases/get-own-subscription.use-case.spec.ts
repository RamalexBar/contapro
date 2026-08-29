import { describe, expect, it } from "vitest";
import { tenantStorage } from "../../../../shared/context/request-context";
import type { IPlanRepository, PlanRecord } from "../../../saas-admin/domain/plan.repository";
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
} from "../../../saas-admin/domain/subscription.repository";
import { GetOwnSubscriptionUseCase } from "./get-own-subscription.use-case";

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
    autoRenew: false,
    wompiPaymentSourceId: null,
    cardLastFour: null,
    cardBrand: null,
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
  async create(): Promise<SubscriptionRecord> {
    throw new Error("not implemented");
  }
  async findByIdOrThrow(): Promise<SubscriptionRecord> {
    throw new Error("not implemented");
  }
  async findActiveByCompanyId(): Promise<SubscriptionRecord | null> {
    throw new Error("not implemented");
  }
  async findLatestByCompanyId(companyId: string): Promise<SubscriptionRecord | null> {
    return this.subscription && this.subscription.companyId === companyId ? this.subscription : null;
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

function withTenantContext<T>(fn: () => Promise<T>): Promise<T> {
  return tenantStorage.run({ companyId: "company-1", branchId: null, userId: "user-1", roles: [], permissions: new Set() }, fn);
}

describe("GetOwnSubscriptionUseCase", () => {
  it("resuelve la suscripcion desde el companyId del contexto, no de un parametro externo", async () => {
    const subscriptionRepo = new FakeSubscriptionRepository();
    subscriptionRepo.subscription = makeSubscription({ companyId: "company-1" });
    const planRepo = new FakePlanRepository();
    planRepo.plans = [makePlan()];
    const useCase = new GetOwnSubscriptionUseCase(subscriptionRepo, planRepo);

    const result = await withTenantContext(() => useCase.execute());

    expect(result.subscription.companyId).toBe("company-1");
    expect(result.plan.code).toBe("TRIAL");
  });

  it("lanza NotFoundError si la empresa nunca tuvo ninguna suscripcion", async () => {
    const subscriptionRepo = new FakeSubscriptionRepository();
    const planRepo = new FakePlanRepository();
    const useCase = new GetOwnSubscriptionUseCase(subscriptionRepo, planRepo);

    await expect(withTenantContext(() => useCase.execute())).rejects.toThrow();
  });

  it("excluye el plan TRIAL y los planes inactivos de availablePlans", async () => {
    const subscriptionRepo = new FakeSubscriptionRepository();
    subscriptionRepo.subscription = makeSubscription();
    const planRepo = new FakePlanRepository();
    planRepo.plans = [
      makePlan({ id: "plan-trial", code: "TRIAL" }),
      makePlan({ id: "plan-basico", code: "BASICO", name: "Plan Emprendedor", isActive: true }),
      makePlan({ id: "plan-viejo", code: "VIEJO", isActive: false }),
    ];
    const useCase = new GetOwnSubscriptionUseCase(subscriptionRepo, planRepo);

    const result = await withTenantContext(() => useCase.execute());

    expect(result.availablePlans.map((p) => p.code)).toEqual(["BASICO"]);
  });

  it("muestra el estado real aunque la suscripcion este SUSPENDED (no un 404 confuso)", async () => {
    const subscriptionRepo = new FakeSubscriptionRepository();
    subscriptionRepo.subscription = makeSubscription({ status: "SUSPENDED" });
    const planRepo = new FakePlanRepository();
    planRepo.plans = [makePlan()];
    const useCase = new GetOwnSubscriptionUseCase(subscriptionRepo, planRepo);

    const result = await withTenantContext(() => useCase.execute());

    expect(result.subscription.status).toBe("SUSPENDED");
  });
});
