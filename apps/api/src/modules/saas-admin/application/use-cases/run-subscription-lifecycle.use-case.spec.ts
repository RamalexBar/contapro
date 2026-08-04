import { describe, expect, it } from "vitest";
import { AuditService } from "../../../audit/application/audit.service";
import type { AuditLogEntry, CreateAuditLogInput, IAuditLogRepository } from "../../../audit/domain/audit-log.repository";
import type { IReminderNotifier, SubscriptionReminderNotification } from "../../domain/reminder-notifier";
import type {
  ApplyPaymentResult,
  CompanyWithSubscriptionRecord,
  ISubscriptionRepository,
  SaasDashboardStats,
  SubscriptionForLifecycleCheck,
  SubscriptionPaymentRecord,
  SubscriptionRecord,
  SubscriptionStatus,
  SubscriptionWithDetails,
} from "../../domain/subscription.repository";
import { RunSubscriptionLifecycleUseCase } from "./run-subscription-lifecycle.use-case";

function makeSubscription(overrides: Partial<SubscriptionForLifecycleCheck> = {}): SubscriptionForLifecycleCheck {
  return {
    id: "sub-1",
    companyId: "company-1",
    companyName: "Minimarket Demo",
    companyEmail: "demo@example.com",
    planId: "plan-1",
    planName: "Plan Basico",
    status: "ACTIVE",
    billingCycle: "MONTHLY",
    startDate: new Date("2026-01-01"),
    currentPeriodEnd: new Date("2026-08-08T00:00:00.000Z"),
    graceEndsAt: null,
    cancelledAt: null,
    createdAt: new Date("2026-01-01"),
    ...overrides,
  };
}

class FakeSubscriptionRepository implements ISubscriptionRepository {
  subscriptions: SubscriptionForLifecycleCheck[] = [];
  reminderLogs = new Set<string>();
  statusUpdates: Array<{ id: string; status: SubscriptionStatus; graceEndsAt?: Date | null }> = [];

  async create(): Promise<SubscriptionRecord> {
    throw new Error("not implemented");
  }
  async findByIdOrThrow(): Promise<SubscriptionRecord> {
    throw new Error("not implemented");
  }
  async findActiveByCompanyId(): Promise<SubscriptionRecord | null> {
    throw new Error("not implemented");
  }
  async list(): Promise<SubscriptionWithDetails[]> {
    throw new Error("not implemented");
  }
  async updateStatus(id: string, status: SubscriptionStatus, graceEndsAt?: Date | null): Promise<SubscriptionRecord> {
    this.statusUpdates.push({ id, status, graceEndsAt });
    const sub = this.subscriptions.find((s) => s.id === id);
    if (sub) {
      sub.status = status;
      if (graceEndsAt !== undefined) sub.graceEndsAt = graceEndsAt;
    }
    return sub as SubscriptionRecord;
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
    return this.subscriptions;
  }
  async hasReminderLog(subscriptionId: string, daysBeforeDue: number): Promise<boolean> {
    return this.reminderLogs.has(`${subscriptionId}:${daysBeforeDue}`);
  }
  async createReminderLog(subscriptionId: string, daysBeforeDue: number): Promise<void> {
    this.reminderLogs.add(`${subscriptionId}:${daysBeforeDue}`);
  }
  async listCompaniesWithSubscription(): Promise<CompanyWithSubscriptionRecord[]> {
    return [];
  }
  async getDashboardStats(): Promise<SaasDashboardStats> {
    throw new Error("not implemented");
  }
}

class FakeReminderNotifier implements IReminderNotifier {
  sent: SubscriptionReminderNotification[] = [];
  shouldFail = false;

  async send(notification: SubscriptionReminderNotification): Promise<void> {
    if (this.shouldFail) throw new Error("proveedor caido");
    this.sent.push(notification);
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

describe("RunSubscriptionLifecycleUseCase", () => {
  it("sends the reminder and logs it when due today", async () => {
    const repo = new FakeSubscriptionRepository();
    repo.subscriptions.push(makeSubscription({ currentPeriodEnd: new Date() }));
    const notifier = new FakeReminderNotifier();
    const auditRepo = new FakeAuditLogRepository();
    const useCase = new RunSubscriptionLifecycleUseCase(repo, notifier, new AuditService(auditRepo));

    await useCase.execute();

    expect(notifier.sent).toHaveLength(1);
    expect(repo.reminderLogs.has("sub-1:0")).toBe(true);
    expect(auditRepo.entries.some((e) => e.action === "SUBSCRIPTION_REMINDER_SENT")).toBe(true);
  });

  it("does not log the reminder when the notifier fails, so it retries next cycle", async () => {
    const repo = new FakeSubscriptionRepository();
    repo.subscriptions.push(makeSubscription({ currentPeriodEnd: new Date() }));
    const notifier = new FakeReminderNotifier();
    notifier.shouldFail = true;
    const auditRepo = new FakeAuditLogRepository();
    const useCase = new RunSubscriptionLifecycleUseCase(repo, notifier, new AuditService(auditRepo));

    await useCase.execute();

    expect(notifier.sent).toHaveLength(0);
    expect(repo.reminderLogs.has("sub-1:0")).toBe(false);
    expect(auditRepo.entries.some((e) => e.action === "SUBSCRIPTION_REMINDER_FAILED")).toBe(true);
  });

  it("does not resend a reminder that was already logged", async () => {
    const repo = new FakeSubscriptionRepository();
    repo.subscriptions.push(makeSubscription({ currentPeriodEnd: new Date() }));
    repo.reminderLogs.add("sub-1:0");
    const notifier = new FakeReminderNotifier();
    const useCase = new RunSubscriptionLifecycleUseCase(repo, notifier, new AuditService(new FakeAuditLogRepository()));

    await useCase.execute();

    expect(notifier.sent).toHaveLength(0);
  });

  it("moves an overdue ACTIVE subscription into GRACE_PERIOD", async () => {
    const repo = new FakeSubscriptionRepository();
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    repo.subscriptions.push(makeSubscription({ currentPeriodEnd: yesterday, status: "ACTIVE" }));
    const useCase = new RunSubscriptionLifecycleUseCase(
      repo,
      new FakeReminderNotifier(),
      new AuditService(new FakeAuditLogRepository())
    );

    await useCase.execute();

    expect(repo.statusUpdates[0]).toMatchObject({ id: "sub-1", status: "GRACE_PERIOD" });
  });

  it("suspends a subscription once the grace period has expired", async () => {
    const repo = new FakeSubscriptionRepository();
    const wellOverdue = new Date();
    wellOverdue.setDate(wellOverdue.getDate() - 10);
    const graceEndsAt = new Date();
    graceEndsAt.setDate(graceEndsAt.getDate() - 5);
    repo.subscriptions.push(
      makeSubscription({ currentPeriodEnd: wellOverdue, status: "GRACE_PERIOD", graceEndsAt })
    );
    const useCase = new RunSubscriptionLifecycleUseCase(
      repo,
      new FakeReminderNotifier(),
      new AuditService(new FakeAuditLogRepository())
    );

    await useCase.execute();

    expect(repo.statusUpdates[0]).toMatchObject({ id: "sub-1", status: "SUSPENDED" });
  });
});
