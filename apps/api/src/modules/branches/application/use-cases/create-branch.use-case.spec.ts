import { describe, expect, it } from "vitest";
import { tenantStorage } from "../../../../shared/context/request-context";
import { AuditService } from "../../../audit/application/audit.service";
import type { AuditLogEntry, CreateAuditLogInput, IAuditLogRepository } from "../../../audit/domain/audit-log.repository";
import type { PlanRecord, IPlanRepository } from "../../../saas-admin/domain/plan.repository";
import type { SubscriptionRecord, ISubscriptionRepository } from "../../../saas-admin/domain/subscription.repository";
import type { BranchRecord, CreateBranchData, IBranchRepository } from "../../domain/branch.repository";
import { CreateBranchUseCase } from "./create-branch.use-case";

const PLAN: PlanRecord = {
  id: "plan-1",
  code: "PYME",
  name: "Plan Pyme",
  priceMonthly: 149_900,
  priceYearly: 1_618_900,
  maxBranches: 2,
  maxUsers: 10,
  features: {},
  isActive: true,
  createdAt: new Date("2026-01-01"),
};

const SUBSCRIPTION: SubscriptionRecord = {
  id: "sub-1",
  companyId: "company-1",
  planId: PLAN.id,
  status: "ACTIVE",
  billingCycle: "MONTHLY",
  startDate: new Date("2026-01-01"),
  currentPeriodEnd: new Date("2026-12-01"),
  graceEndsAt: null,
  cancelledAt: null,
  createdAt: new Date("2026-01-01"),
  autoRenew: false,
  wompiPaymentSourceId: null,
  cardLastFour: null,
  cardBrand: null,
};

class FakeBranchRepository implements Partial<IBranchRepository> {
  created: Array<{ companyId: string; data: CreateBranchData }> = [];
  existingCount = 1;
  existingCodes = new Set<string>();

  async countActive(): Promise<number> {
    return this.existingCount;
  }
  async existsByCode(_companyId: string, code: string): Promise<boolean> {
    return this.existingCodes.has(code);
  }
  async create(companyId: string, data: CreateBranchData): Promise<BranchRecord> {
    this.created.push({ companyId, data });
    return { id: `branch-${this.created.length}`, name: data.name, code: data.code, address: data.address ?? null, phone: data.phone ?? null, isMain: false, isActive: true };
  }
}

class FakeSubscriptionRepository implements Partial<ISubscriptionRepository> {
  subscription: SubscriptionRecord | null = SUBSCRIPTION;
  async findActiveByCompanyId(): Promise<SubscriptionRecord | null> {
    return this.subscription;
  }
}

class FakePlanRepository implements Partial<IPlanRepository> {
  async findByIdOrThrow(): Promise<PlanRecord> {
    return PLAN;
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

function withTenantContext<T>(fn: () => Promise<T>): Promise<T> {
  return tenantStorage.run({ companyId: "company-1", branchId: null, userId: "user-1", roles: [], permissions: new Set() }, fn);
}

function makeUseCase() {
  const branchRepo = new FakeBranchRepository();
  const subscriptionRepo = new FakeSubscriptionRepository();
  const planRepo = new FakePlanRepository();
  const auditRepo = new FakeAuditLogRepository();
  const useCase = new CreateBranchUseCase(
    branchRepo as unknown as IBranchRepository,
    subscriptionRepo as unknown as ISubscriptionRepository,
    planRepo as unknown as IPlanRepository,
    new AuditService(auditRepo)
  );
  return { useCase, branchRepo, subscriptionRepo, auditRepo };
}

describe("CreateBranchUseCase", () => {
  it("crea la sucursal cuando el plan todavia tiene cupo", async () => {
    const { useCase, branchRepo } = makeUseCase();
    branchRepo.existingCount = 1; // PLAN.maxBranches = 2

    const branch = await withTenantContext(() => useCase.execute({ name: "Sucursal Norte" }));

    expect(branch.name).toBe("Sucursal Norte");
    expect(branch.code).toBe("SUCURSAL"); // slugify: sin espacios/tildes, recortado a 8 caracteres
  });

  it("rechaza crear una sucursal cuando ya se alcanzo el limite del plan (maxBranches)", async () => {
    const { useCase, branchRepo } = makeUseCase();
    branchRepo.existingCount = 2; // == PLAN.maxBranches

    await expect(withTenantContext(() => useCase.execute({ name: "Sucursal Sur" }))).rejects.toThrow(/Plan Pyme.*hasta 2 sucursales/);
  });

  it("rechaza si la empresa no tiene una suscripcion activa", async () => {
    const { useCase, subscriptionRepo } = makeUseCase();
    subscriptionRepo.subscription = null;

    await expect(withTenantContext(() => useCase.execute({ name: "Sucursal Sur" }))).rejects.toThrow(/no tiene una suscripcion activa/);
  });

  it("deriva el codigo del nombre, sin tildes ni espacios, y le agrega un sufijo si ya existe", async () => {
    const { useCase, branchRepo } = makeUseCase();
    branchRepo.existingCodes.add("BODEGAPR"); // slugify("Bodega Principal") trunca a 8 chars

    const branch = await withTenantContext(() => useCase.execute({ name: "Bodega Principal" }));

    expect(branch.code).toBe("BODEGAPR2");
  });

  it("registra un log de auditoria al crear la sucursal", async () => {
    const { useCase, auditRepo } = makeUseCase();

    await withTenantContext(() => useCase.execute({ name: "Sucursal Norte" }));

    expect(auditRepo.entries).toHaveLength(1);
    expect(auditRepo.entries[0]).toMatchObject({ action: "BRANCH_CREATED", entityType: "Branch" });
  });
});
