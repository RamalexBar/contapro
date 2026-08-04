import { basePrisma } from "@erp/database";
import { NotFoundError } from "../../../shared/errors/app-error";
import type {
  ApplyPaymentData,
  ApplyPaymentResult,
  CompanyWithSubscriptionRecord,
  CreatePendingPaymentData,
  CreateSubscriptionData,
  ISubscriptionRepository,
  SaasDashboardStats,
  SubscriptionForLifecycleCheck,
  SubscriptionPaymentRecord,
  SubscriptionRecord,
  SubscriptionStatus,
  SubscriptionWithDetails,
} from "../domain/subscription.repository";

type SubscriptionRow = {
  id: string;
  companyId: string;
  planId: string;
  status: string;
  billingCycle: string;
  startDate: Date;
  currentPeriodEnd: Date;
  graceEndsAt: Date | null;
  cancelledAt: Date | null;
  createdAt: Date;
};

function toRecord(row: SubscriptionRow): SubscriptionRecord {
  return {
    id: row.id,
    companyId: row.companyId,
    planId: row.planId,
    status: row.status as SubscriptionStatus,
    billingCycle: row.billingCycle,
    startDate: row.startDate,
    currentPeriodEnd: row.currentPeriodEnd,
    graceEndsAt: row.graceEndsAt,
    cancelledAt: row.cancelledAt,
    createdAt: row.createdAt,
  };
}

function toPaymentRecord(row: {
  id: string;
  subscriptionId: string;
  amount: unknown;
  method: string;
  reference: string | null;
  status: string;
  paidAt: Date | null;
  createdAt: Date;
}): SubscriptionPaymentRecord {
  return {
    id: row.id,
    subscriptionId: row.subscriptionId,
    amount: Number(row.amount),
    method: row.method,
    reference: row.reference,
    status: row.status,
    paidAt: row.paidAt,
    createdAt: row.createdAt,
  };
}

const LIFECYCLE_STATUSES: SubscriptionStatus[] = ["TRIALING", "ACTIVE", "GRACE_PERIOD"];

/** basePrisma en todo el archivo: este panel corre transversal a todas las empresas, sin
 * AsyncLocalStorage/tenant context (ver README del modulo). */
export class PrismaSubscriptionRepository implements ISubscriptionRepository {
  async create(data: CreateSubscriptionData): Promise<SubscriptionRecord> {
    const row = await basePrisma.subscription.create({
      data: {
        companyId: data.companyId,
        planId: data.planId,
        status: data.status,
        billingCycle: data.billingCycle,
        startDate: data.startDate,
        currentPeriodEnd: data.currentPeriodEnd,
      },
    });
    return toRecord(row);
  }

  async findByIdOrThrow(id: string): Promise<SubscriptionRecord> {
    const row = await basePrisma.subscription.findUnique({ where: { id } });
    if (!row) throw new NotFoundError("Subscription", id);
    return toRecord(row);
  }

  async findActiveByCompanyId(companyId: string): Promise<SubscriptionRecord | null> {
    const row = await basePrisma.subscription.findFirst({
      where: { companyId, status: { in: ["TRIALING", "ACTIVE", "GRACE_PERIOD"] } },
      orderBy: { createdAt: "desc" },
    });
    return row ? toRecord(row) : null;
  }

  async list(filter?: { status?: SubscriptionStatus }): Promise<SubscriptionWithDetails[]> {
    const rows = await basePrisma.subscription.findMany({
      where: filter?.status ? { status: filter.status } : undefined,
      include: { company: { select: { name: true } }, plan: { select: { name: true, code: true } } },
      orderBy: { currentPeriodEnd: "asc" },
    });
    return rows.map((row) => ({
      ...toRecord(row),
      companyName: row.company.name,
      planName: row.plan.name,
      planCode: row.plan.code,
    }));
  }

  async updateStatus(id: string, status: SubscriptionStatus, graceEndsAt?: Date | null): Promise<SubscriptionRecord> {
    await this.findByIdOrThrow(id);
    const row = await basePrisma.subscription.update({
      where: { id },
      data: { status, graceEndsAt: graceEndsAt === undefined ? undefined : graceEndsAt },
    });
    return toRecord(row);
  }

  async applyPayment(id: string, data: ApplyPaymentData): Promise<ApplyPaymentResult> {
    await this.findByIdOrThrow(id);

    const result = await basePrisma.$transaction(async (tx) => {
      const payment = await tx.subscriptionPayment.create({
        data: {
          subscriptionId: id,
          amount: data.amount,
          method: data.method,
          reference: data.reference,
          status: "CONFIRMED",
          paidAt: new Date(),
        },
      });
      const subscription = await tx.subscription.update({
        where: { id },
        data: { status: "ACTIVE", currentPeriodEnd: data.newPeriodEnd, graceEndsAt: null },
      });
      return { subscription, payment };
    });

    return { subscription: toRecord(result.subscription), payment: toPaymentRecord(result.payment) };
  }

  async createPendingPayment(data: CreatePendingPaymentData): Promise<SubscriptionPaymentRecord> {
    const row = await basePrisma.subscriptionPayment.create({
      data: {
        subscriptionId: data.subscriptionId,
        amount: data.amount,
        method: data.method,
        reference: data.reference,
        status: "PENDING",
      },
    });
    return toPaymentRecord(row);
  }

  async findPaymentByReference(reference: string): Promise<SubscriptionPaymentRecord | null> {
    const row = await basePrisma.subscriptionPayment.findFirst({ where: { reference } });
    return row ? toPaymentRecord(row) : null;
  }

  async confirmPayment(paymentId: string, newPeriodEnd: Date): Promise<ApplyPaymentResult> {
    const existing = await basePrisma.subscriptionPayment.findUnique({ where: { id: paymentId } });
    if (!existing) throw new NotFoundError("SubscriptionPayment", paymentId);

    const result = await basePrisma.$transaction(async (tx) => {
      const payment = await tx.subscriptionPayment.update({
        where: { id: paymentId },
        data: { status: "CONFIRMED", paidAt: new Date() },
      });
      const subscription = await tx.subscription.update({
        where: { id: existing.subscriptionId },
        data: { status: "ACTIVE", currentPeriodEnd: newPeriodEnd, graceEndsAt: null },
      });
      return { subscription, payment };
    });

    return { subscription: toRecord(result.subscription), payment: toPaymentRecord(result.payment) };
  }

  async failPayment(paymentId: string): Promise<SubscriptionPaymentRecord> {
    const row = await basePrisma.subscriptionPayment.update({ where: { id: paymentId }, data: { status: "FAILED" } });
    return toPaymentRecord(row);
  }

  async listForLifecycleCheck(): Promise<SubscriptionForLifecycleCheck[]> {
    const rows = await basePrisma.subscription.findMany({
      where: { status: { in: LIFECYCLE_STATUSES } },
      include: { company: { select: { name: true, email: true } }, plan: { select: { name: true } } },
    });
    return rows.map((row) => ({
      ...toRecord(row),
      companyName: row.company.name,
      companyEmail: row.company.email,
      planName: row.plan.name,
    }));
  }

  async hasReminderLog(subscriptionId: string, daysBeforeDue: number): Promise<boolean> {
    const row = await basePrisma.subscriptionReminderLog.findUnique({
      where: { subscriptionId_daysBeforeDue: { subscriptionId, daysBeforeDue } },
    });
    return row !== null;
  }

  async createReminderLog(subscriptionId: string, daysBeforeDue: number, channel: string): Promise<void> {
    await basePrisma.subscriptionReminderLog.create({ data: { subscriptionId, daysBeforeDue, channel } });
  }

  async listCompaniesWithSubscription(): Promise<CompanyWithSubscriptionRecord[]> {
    const companies = await basePrisma.company.findMany({
      include: {
        subscriptions: {
          orderBy: { createdAt: "desc" },
          take: 1,
          include: { plan: { select: { name: true } } },
        },
      },
      orderBy: { name: "asc" },
    });

    return companies.map((company) => {
      const subscription = company.subscriptions[0];
      return {
        companyId: company.id,
        companyName: company.name,
        nit: company.nit,
        isActive: company.isActive,
        subscriptionStatus: subscription ? (subscription.status as SubscriptionStatus) : null,
        planName: subscription?.plan.name ?? null,
        currentPeriodEnd: subscription?.currentPeriodEnd ?? null,
        graceEndsAt: subscription?.graceEndsAt ?? null,
      };
    });
  }

  async getDashboardStats(): Promise<SaasDashboardStats> {
    const grouped = await basePrisma.subscription.groupBy({ by: ["status"], _count: { _all: true } });
    const companiesByStatus: Record<SubscriptionStatus, number> = {
      TRIALING: 0,
      ACTIVE: 0,
      GRACE_PERIOD: 0,
      SUSPENDED: 0,
      CANCELLED: 0,
    };
    for (const g of grouped) companiesByStatus[g.status as SubscriptionStatus] = g._count._all;

    const now = new Date();
    const in8Days = new Date(now);
    in8Days.setDate(in8Days.getDate() + 8);
    const upcomingRenewals = await basePrisma.subscription.count({
      where: { status: { in: LIFECYCLE_STATUSES }, currentPeriodEnd: { gte: now, lte: in8Days } },
    });

    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const revenueAgg = await basePrisma.subscriptionPayment.aggregate({
      where: { status: "CONFIRMED", paidAt: { gte: startOfMonth } },
      _sum: { amount: true },
    });

    return {
      companiesByStatus,
      upcomingRenewals,
      monthlyRevenueConfirmed: Number(revenueAgg._sum.amount ?? 0),
    };
  }
}
