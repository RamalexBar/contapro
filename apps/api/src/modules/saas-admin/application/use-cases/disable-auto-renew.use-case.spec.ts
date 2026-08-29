import { describe, expect, it } from "vitest";
import { AuditService } from "../../../audit/application/audit.service";
import type { AuditLogEntry, CreateAuditLogInput, IAuditLogRepository } from "../../../audit/domain/audit-log.repository";
import type {
  ApplyPaymentResult,
  CompanyWithSubscriptionRecord,
  ISubscriptionRepository,
  SaasDashboardStats,
  SubscriptionDueForAutoCharge,
  SubscriptionForLifecycleCheck,
  SubscriptionPaymentRecord,
  SubscriptionRecord,
  SubscriptionWithDetails,
} from "../../domain/subscription.repository";
import { DisableAutoRenewUseCase } from "./disable-auto-renew.use-case";

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
    autoRenew: true,
    wompiPaymentSourceId: "ps-1",
    cardLastFour: "4242",
    cardBrand: "VISA",
    ...overrides,
  };
}

class FakeSubscriptionRepository implements ISubscriptionRepository {
  subscription: SubscriptionRecord | null = null;
  disabledIds: string[] = [];

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
  async savePaymentSource(): Promise<SubscriptionRecord> {
    throw new Error("not implemented");
  }
  async disableAutoRenew(id: string): Promise<SubscriptionRecord> {
    this.disabledIds.push(id);
    this.subscription = { ...this.subscription!, autoRenew: false };
    return this.subscription;
  }
  async listDueForAutoCharge(): Promise<SubscriptionDueForAutoCharge[]> {
    throw new Error("not implemented");
  }
  async hasAutoChargeAttemptSince(): Promise<boolean> {
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

describe("DisableAutoRenewUseCase", () => {
  it("apaga autoRenew sin tocar status ni currentPeriodEnd", async () => {
    const subscriptionRepo = new FakeSubscriptionRepository();
    subscriptionRepo.subscription = makeSubscription();
    const auditRepo = new FakeAuditLogRepository();
    const useCase = new DisableAutoRenewUseCase(subscriptionRepo, new AuditService(auditRepo));

    const result = await useCase.execute("sub-1");

    expect(result.autoRenew).toBe(false);
    expect(result.status).toBe("ACTIVE");
    expect(result.currentPeriodEnd).toEqual(new Date("2026-08-08"));
    expect(subscriptionRepo.disabledIds).toEqual(["sub-1"]);
    expect(auditRepo.entries.some((e) => e.action === "SUBSCRIPTION_AUTO_RENEW_DISABLED")).toBe(true);
  });
});
