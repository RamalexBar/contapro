import { describe, expect, it } from "vitest";
import { tenantStorage } from "../../../../shared/context/request-context";
import { AuditService } from "../../../audit/application/audit.service";
import type { AuditLogEntry, CreateAuditLogInput, IAuditLogRepository } from "../../../audit/domain/audit-log.repository";
import type { IPlanRepository, PlanRecord } from "../../../saas-admin/domain/plan.repository";
import type { ISubscriptionRepository, SubscriptionRecord } from "../../../saas-admin/domain/subscription.repository";
import type { BranchRecord, IBranchRepository, UpdateBranchData } from "../../domain/branch.repository";
import { UpdateBranchUseCase } from "./update-branch.use-case";

const MAIN: BranchRecord = { id: "main", name: "Principal", code: "PRINCIPA", address: null, phone: null, isMain: true, isActive: true };
const NORTE: BranchRecord = { id: "norte", name: "Norte", code: "NORTE", address: null, phone: null, isMain: false, isActive: true };

class FakeBranchRepository implements Partial<IBranchRepository> {
  branches = new Map<string, BranchRecord>([
    [MAIN.id, { ...MAIN }],
    [NORTE.id, { ...NORTE }],
  ]);
  openSessions = new Set<string>();
  deactivated: string[] = [];

  async findById(_companyId: string, id: string) {
    return this.branches.get(id) ?? null;
  }
  async countActive() {
    return [...this.branches.values()].filter((b) => b.isActive).length;
  }
  async update(_companyId: string, id: string, data: UpdateBranchData) {
    const updated = { ...this.branches.get(id)!, ...data } as BranchRecord;
    this.branches.set(id, updated);
    return updated;
  }
  async hasOpenCashSession(branchId: string) {
    return this.openSessions.has(branchId);
  }
  async deactivate(_companyId: string, id: string) {
    this.deactivated.push(id);
    const updated = { ...this.branches.get(id)!, isActive: false };
    this.branches.set(id, updated);
    return updated;
  }
  async reactivate(_companyId: string, id: string) {
    const updated = { ...this.branches.get(id)!, isActive: true };
    this.branches.set(id, updated);
    return updated;
  }
}

const PLAN = { id: "plan-1", name: "Plan Pyme", maxBranches: 2 } as PlanRecord;

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

function run<T>(fn: () => Promise<T>): Promise<T> {
  return tenantStorage.run({ companyId: "company-1", branchId: null, userId: "user-1", roles: [], permissions: new Set() }, fn);
}

function makeUseCase() {
  const branchRepo = new FakeBranchRepository();
  const auditRepo = new FakeAuditLogRepository();
  const useCase = new UpdateBranchUseCase(
    branchRepo as unknown as IBranchRepository,
    { findActiveByCompanyId: async () => ({ planId: PLAN.id }) as SubscriptionRecord } as unknown as ISubscriptionRepository,
    { findByIdOrThrow: async () => PLAN } as unknown as IPlanRepository,
    new AuditService(auditRepo)
  );
  return { useCase, branchRepo, auditRepo };
}

describe("UpdateBranchUseCase", () => {
  it("updates name and address and records it in the audit log", async () => {
    const { useCase, auditRepo } = makeUseCase();

    const result = await run(() => useCase.execute("norte", { name: "Norte Centro", address: "Calle 10" }));

    expect(result).toMatchObject({ name: "Norte Centro", address: "Calle 10" });
    expect(auditRepo.entries[0]).toMatchObject({ action: "BRANCH_UPDATED", entityId: "norte" });
  });

  it("refuses to deactivate the main branch", async () => {
    const { useCase } = makeUseCase();
    await expect(run(() => useCase.execute("main", { isActive: false }))).rejects.toThrow(/principal no se puede desactivar/);
  });

  it("refuses to deactivate a branch whose cash register is still open", async () => {
    const { useCase, branchRepo } = makeUseCase();
    branchRepo.openSessions.add("norte");

    await expect(run(() => useCase.execute("norte", { isActive: false }))).rejects.toThrow(/Cierra la caja de Norte/);
    expect(branchRepo.deactivated).toEqual([]);
  });

  it("refuses to deactivate the branch the user is working in", async () => {
    const { useCase, branchRepo } = makeUseCase();

    await expect(
      tenantStorage.run({ companyId: "company-1", branchId: "norte", userId: "user-1", roles: [], permissions: new Set() }, () =>
        useCase.execute("norte", { isActive: false })
      )
    ).rejects.toThrow(/Estas trabajando en Norte/);
    expect(branchRepo.deactivated).toEqual([]);
  });

  it("deactivates a branch with its cash closed", async () => {
    const { useCase, branchRepo } = makeUseCase();

    const result = await run(() => useCase.execute("norte", { isActive: false }));

    expect(result.isActive).toBe(false);
    expect(branchRepo.deactivated).toEqual(["norte"]);
  });

  it("reactivating counts against the plan limit", async () => {
    const { useCase, branchRepo } = makeUseCase();
    branchRepo.branches.set("sur", { ...NORTE, id: "sur", name: "Sur", isActive: false });

    await expect(run(() => useCase.execute("sur", { isActive: true }))).rejects.toThrow(/hasta 2 sucursales activas/);

    await run(() => useCase.execute("norte", { isActive: false }));
    const reactivated = await run(() => useCase.execute("sur", { isActive: true }));
    expect(reactivated.isActive).toBe(true);
  });
});
