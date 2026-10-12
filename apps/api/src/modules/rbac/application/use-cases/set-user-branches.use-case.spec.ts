import { describe, expect, it } from "vitest";
import { tenantStorage } from "../../../../shared/context/request-context";
import { AuditService } from "../../../audit/application/audit.service";
import type { AuditLogEntry, CreateAuditLogInput, IAuditLogRepository } from "../../../audit/domain/audit-log.repository";
import type { IUserDirectoryRepository, UserSummary } from "../../domain/rbac.types";
import { SetUserBranchesUseCase } from "./set-user-branches.use-case";

const BRANCHES = [
  { id: "11111111-1111-4111-8111-111111111111", name: "Principal" },
  { id: "22222222-2222-4222-8222-222222222222", name: "Norte" },
];

class FakeUserDirectory {
  saved: { userId: string; branchIds: string[]; defaultBranchId: string } | null = null;
  async findActiveBranches(ids: string[]) {
    return BRANCHES.filter((b) => ids.includes(b.id));
  }
  async setBranches(userId: string, branchIds: string[], defaultBranchId: string): Promise<UserSummary> {
    this.saved = { userId, branchIds, defaultBranchId };
    return {
      id: userId,
      email: "cajero@demo.com",
      fullName: "Cajero Uno",
      isActive: true,
      roles: ["CAJERO"],
      branches: BRANCHES.filter((b) => branchIds.includes(b.id)).map((b) => ({ ...b, isDefault: b.id === defaultBranchId })),
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
  return tenantStorage.run({ companyId: "company-1", branchId: null, userId: "admin", roles: [], permissions: new Set() }, fn);
}

describe("SetUserBranchesUseCase", () => {
  it("assigns the branches and names the default one in the audit log", async () => {
    const directory = new FakeUserDirectory();
    const auditRepo = new FakeAuditLogRepository();
    const useCase = new SetUserBranchesUseCase(directory as unknown as IUserDirectoryRepository, new AuditService(auditRepo));

    const user = await run(() =>
      useCase.execute("cajero", { branchIds: [BRANCHES[0]!.id, BRANCHES[1]!.id], defaultBranchId: BRANCHES[1]!.id })
    );

    expect(directory.saved).toEqual({ userId: "cajero", branchIds: [BRANCHES[0]!.id, BRANCHES[1]!.id], defaultBranchId: BRANCHES[1]!.id });
    expect(user.branches.find((b) => b.isDefault)?.name).toBe("Norte");
    expect(auditRepo.entries[0]?.description).toContain("Norte (por defecto)");
  });

  it("rejects a branch that does not exist or is inactive, without saving", async () => {
    const directory = new FakeUserDirectory();
    const useCase = new SetUserBranchesUseCase(directory as unknown as IUserDirectoryRepository, new AuditService(new FakeAuditLogRepository()));
    const unknown = "33333333-3333-4333-8333-333333333333";

    await expect(run(() => useCase.execute("cajero", { branchIds: [unknown], defaultBranchId: unknown }))).rejects.toThrow(
      /no existe o esta desactivada/
    );
    expect(directory.saved).toBeNull();
  });
});
