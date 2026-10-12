import { describe, expect, it, vi } from "vitest";
import { tenantStorage } from "../../../../shared/context/request-context";
import { AuditService } from "../../../audit/application/audit.service";
import type { AuditLogEntry, CreateAuditLogInput, IAuditLogRepository } from "../../../audit/domain/audit-log.repository";
import type { IUserRepository, SelectableBranch, UserWithAccess } from "../../domain/user.repository";
import { SwitchBranchUseCase } from "./switch-branch.use-case";

// El token se firma con el secreto del .env; aqui solo importa que lleve la sucursal nueva.
vi.mock("../../infrastructure/jwt.service", () => ({
  signAccessToken: (payload: { branchId: string | null }) => `token-for-${payload.branchId}`,
}));

const MAIN: SelectableBranch = { id: "main", name: "Principal", isMain: true };
const NORTE: SelectableBranch = { id: "norte", name: "Norte", isMain: false };
const SUR: SelectableBranch = { id: "sur", name: "Sur", isMain: false };

class FakeUserRepository {
  assigned = new Map<string, string[]>([["cajero", ["main", "norte"]]]);
  defaults = new Map<string, string>([["cajero", "main"]]);

  async listSelectableBranches(_companyId: string, userId: string, allOfCompany: boolean) {
    const all = [MAIN, NORTE, SUR];
    return allOfCompany ? all : all.filter((b) => (this.assigned.get(userId) ?? []).includes(b.id));
  }
  async setDefaultBranch(userId: string, branchId: string) {
    this.defaults.set(userId, branchId);
    const list = this.assigned.get(userId) ?? [];
    if (!list.includes(branchId)) this.assigned.set(userId, [...list, branchId]);
  }
  async findByIdWithAccess(userId: string): Promise<UserWithAccess> {
    return {
      id: userId,
      companyId: "company-1",
      email: `${userId}@demo.com`,
      passwordHash: "x",
      pinHash: null,
      fullName: "Cajero Uno",
      isActive: true,
      failedLoginAttempts: 0,
      lockedUntil: null,
      defaultBranchId: this.defaults.get(userId) ?? null,
      roles: ["CAJERO"],
      permissions: ["sale.create"],
    };
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

function run<T>(fn: () => Promise<T>): Promise<T> {
  return tenantStorage.run({ companyId: "company-1", branchId: "main", userId: "cajero", roles: [], permissions: new Set() }, fn);
}

function makeUseCase() {
  const userRepo = new FakeUserRepository();
  const auditRepo = new FakeAuditLogRepository();
  const useCase = new SwitchBranchUseCase(userRepo as unknown as IUserRepository, new AuditService(auditRepo));
  return { useCase, userRepo, auditRepo };
}

describe("SwitchBranchUseCase", () => {
  it("switches an assigned user and returns a token for the new branch, saved as default", async () => {
    const { useCase, userRepo, auditRepo } = makeUseCase();

    const result = await run(() => useCase.execute({ userId: "cajero", companyId: "company-1", branchId: "norte", canManageBranches: false }));

    expect(result.accessToken).toBe("token-for-norte");
    expect(result.user.branchId).toBe("norte");
    expect(userRepo.defaults.get("cajero")).toBe("norte");
    expect(auditRepo.entries[0]).toMatchObject({ action: "BRANCH_SWITCHED" });
  });

  it("refuses a branch the user is not assigned to", async () => {
    const { useCase, userRepo } = makeUseCase();

    await expect(
      run(() => useCase.execute({ userId: "cajero", companyId: "company-1", branchId: "sur", canManageBranches: false }))
    ).rejects.toThrow(/No estas asignado a esa sucursal/);
    expect(userRepo.defaults.get("cajero")).toBe("main");
  });

  it("lets a branch manager enter any branch", async () => {
    const { useCase } = makeUseCase();

    const result = await run(() => useCase.execute({ userId: "cajero", companyId: "company-1", branchId: "sur", canManageBranches: true }));

    expect(result.user.branchId).toBe("sur");
  });

  it("rejects a branch that does not exist in the company", async () => {
    const { useCase } = makeUseCase();

    await expect(
      run(() => useCase.execute({ userId: "cajero", companyId: "company-1", branchId: "otra", canManageBranches: true }))
    ).rejects.toThrow(/no encontrad/i);
  });

  it("lists only assigned branches for a cashier and all of them for a manager", async () => {
    const { useCase } = makeUseCase();

    expect((await useCase.listSelectable("cajero", "company-1", false)).map((b) => b.id)).toEqual(["main", "norte"]);
    expect((await useCase.listSelectable("cajero", "company-1", true)).map((b) => b.id)).toEqual(["main", "norte", "sur"]);
  });
});
