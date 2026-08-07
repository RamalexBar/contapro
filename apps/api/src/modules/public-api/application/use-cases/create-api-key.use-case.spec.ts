import { describe, expect, it } from "vitest";
import { tenantStorage } from "../../../../shared/context/request-context";
import { AuditService } from "../../../audit/application/audit.service";
import type { AuditLogEntry, CreateAuditLogInput, IAuditLogRepository } from "../../../audit/domain/audit-log.repository";
import type { ApiKeyRecord, CreateApiKeyData, IApiKeyRepository } from "../../domain/api-key.repository";
import { CreateApiKeyUseCase } from "./create-api-key.use-case";

class FakeApiKeyRepository implements Partial<IApiKeyRepository> {
  created: CreateApiKeyData[] = [];
  async create(data: CreateApiKeyData): Promise<ApiKeyRecord> {
    this.created.push(data);
    return {
      id: "key-1",
      name: data.name,
      keyPrefix: data.keyPrefix,
      scopes: data.scopes,
      isActive: true,
      lastUsedAt: null,
      createdByUserId: data.createdByUserId,
      createdAt: new Date(),
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

function withTenantContext<T>(permissions: string[], fn: () => Promise<T>): Promise<T> {
  return tenantStorage.run(
    { companyId: "company-1", branchId: null, userId: "user-1", roles: [], permissions: new Set(permissions) },
    fn
  );
}

function makeUseCase() {
  const repo = new FakeApiKeyRepository();
  const auditRepo = new FakeAuditLogRepository();
  const useCase = new CreateApiKeyUseCase(repo as unknown as IApiKeyRepository, new AuditService(auditRepo));
  return { useCase, repo };
}

describe("CreateApiKeyUseCase", () => {
  it("generates a random key, hashes it, and stores only the hash + a short prefix", async () => {
    const { useCase, repo } = makeUseCase();

    const result = await withTenantContext(["product.read", "sale.create"], () =>
      useCase.execute({ name: "Integracion Shopify", scopes: ["product.read"] })
    );

    expect(result.key).toMatch(/^pk_live_[a-f0-9]{48}$/);
    expect(repo.created[0].keyHash).not.toBe(result.key);
    expect(repo.created[0].keyHash).toHaveLength(64); // sha256 hex
    expect(result.keyPrefix).toBe(result.key.slice(0, result.keyPrefix.length));
  });

  it("rejects a scope the creator does not have", async () => {
    await expect(
      withTenantContext(["product.read"], () => makeUseCase().useCase.execute({ name: "Test", scopes: ["rbac.manage"] }))
    ).rejects.toThrow(/No puedes otorgar scopes/);
  });

  it("rejects creating a key with no scopes", async () => {
    await expect(
      withTenantContext(["product.read"], () => makeUseCase().useCase.execute({ name: "Test", scopes: [] }))
    ).rejects.toThrow(/al menos un scope/);
  });
});
