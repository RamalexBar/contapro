import { describe, expect, it } from "vitest";
import { createHash } from "node:crypto";
import { verifySecret } from "../../../auth/infrastructure/password-hasher.service";
import type { AuditService } from "../../../audit/application/audit.service";
import type {
  IPartnerAccountRepository,
  IssuePartnerApiKeyData,
  NewPartnerCompanyData,
  Partner,
  PartnerAccountRecord,
  PartnerPlanDefinition,
} from "../../domain/partner-account.repository";
import { CAJAPRO_API_KEY_SCOPES, ProvisionPartnerAccountUseCase, type ProvisionPartnerAccountInput } from "./provision-partner-account.use-case";

class FakePartnerRepo implements IPartnerAccountRepository {
  accounts: PartnerAccountRecord[] = [];
  companies: (NewPartnerCompanyData & { id: string; users: { id: string; email: string }[] })[] = [];
  plans: (PartnerPlanDefinition & { id: string })[] = [];
  subscriptions: { companyId: string; planId: string; currentPeriodEnd: Date; billedBy: Partner }[] = [];
  apiKeys: (IssuePartnerApiKeyData & { id: string; isActive: boolean })[] = [];

  async findByExternalId(partner: Partner, externalId: string) {
    return this.accounts.find((a) => a.partner === partner && a.externalId === externalId) ?? null;
  }
  async findCompanyIdByNit(nit: string) {
    return this.companies.find((c) => c.nit === nit)?.id ?? null;
  }
  async findUserIdByEmail(companyId: string, email: string) {
    return this.companies.find((c) => c.id === companyId)?.users.find((u) => u.email === email.toLowerCase())?.id ?? null;
  }
  async findAdminUserId(companyId: string) {
    return this.companies.find((c) => c.id === companyId)?.users[0]?.id ?? null;
  }
  async createCompany(data: NewPartnerCompanyData) {
    const id = `co-${this.companies.length + 1}`;
    const adminUserId = `${id}-admin`;
    this.companies.push({ ...data, id, users: [{ id: adminUserId, email: data.adminEmail }] });
    return { companyId: id, adminUserId };
  }
  async create(data: { partner: Partner; externalId: string; companyId: string }) {
    const row = { id: `pa-${this.accounts.length + 1}`, apiKeyId: null, ...data };
    this.accounts.push(row);
    return row;
  }
  async setApiKey(accountId: string, apiKeyId: string) {
    this.accounts.find((a) => a.id === accountId)!.apiKeyId = apiKeyId;
  }
  async ensurePlan(plan: PartnerPlanDefinition) {
    let row = this.plans.find((p) => p.code === plan.code);
    if (!row) this.plans.push((row = { ...plan, id: `plan-${plan.code}` }));
    return row.id;
  }
  async upsertPartnerSubscription(data: { companyId: string; planId: string; currentPeriodEnd: Date; billedBy: Partner }) {
    this.subscriptions = this.subscriptions.filter((s) => s.companyId !== data.companyId);
    this.subscriptions.push(data);
  }
  async issueApiKey(data: IssuePartnerApiKeyData) {
    const revoked = this.apiKeys.find((k) => k.id === data.revokeApiKeyId);
    if (revoked) revoked.isActive = false;
    const id = `key-${this.apiKeys.length + 1}`;
    this.apiKeys.push({ ...data, id, isActive: true });
    return id;
  }
  async listBranches() {
    return [{ id: "br-1", name: "Principal" }];
  }
}

const audit = { recordWithoutContext: async () => undefined } as unknown as AuditService;

function input(overrides: Partial<ProvisionPartnerAccountInput> = {}): ProvisionPartnerAccountInput {
  return {
    partner: "CAJAPRO",
    externalId: "biz-1",
    company: { name: "Restaurante El Roble", legalName: "El Roble SAS", nit: "900123456", dv: "7", documentType: "NIT", email: "roble@correo.com" },
    owner: { fullName: "Ana Perez", email: "Ana@Correo.com" },
    paidUntil: new Date("2027-10-23T00:00:00Z"),
    issueApiKey: false,
    ...overrides,
  };
}

describe("ProvisionPartnerAccountUseCase", () => {
  it("creates the company, its combo subscription billed by Cajapro and an API key with Cajapro's scopes", async () => {
    const repo = new FakePartnerRepo();
    const result = await new ProvisionPartnerAccountUseCase(repo, audit).execute(input());

    expect(result.created).toBe(true);
    expect(result.adminEmail).toBe("ana@correo.com");
    expect(repo.companies[0]).toMatchObject({ nit: "900123456", dv: "7", adminEmail: "ana@correo.com" });
    expect(await verifySecret(result.temporaryPassword!, repo.companies[0].adminPasswordHash)).toBe(true);

    expect(repo.plans[0]).toMatchObject({ code: "COMBO_CAJAPRO", maxBranches: 1, maxUsers: 3, maxElectronicDocumentsPerMonth: 150 });
    expect(repo.subscriptions).toEqual([
      { companyId: result.companyId, planId: "plan-COMBO_CAJAPRO", currentPeriodEnd: new Date("2027-10-23T00:00:00Z"), billedBy: "CAJAPRO" },
    ]);

    expect(result.apiKey).toMatch(/^pk_live_/);
    expect(repo.apiKeys[0].keyHash).toBe(createHash("sha256").update(result.apiKey!).digest("hex"));
    expect(repo.apiKeys[0].scopes).toEqual(CAJAPRO_API_KEY_SCOPES);
    expect(repo.apiKeys[0].createdByUserId).toBe(`${result.companyId}-admin`);
    expect(result.branches).toEqual([{ id: "br-1", name: "Principal" }]);
  });

  it("on renewal only moves the paid-until date: no new company, password or API key", async () => {
    const repo = new FakePartnerRepo();
    const useCase = new ProvisionPartnerAccountUseCase(repo, audit);
    const first = await useCase.execute(input());
    const renewal = await useCase.execute(input({ paidUntil: new Date("2028-10-23T00:00:00Z") }));

    expect(renewal).toMatchObject({ companyId: first.companyId, created: false, temporaryPassword: null, apiKey: null });
    expect(repo.companies).toHaveLength(1);
    expect(repo.apiKeys).toHaveLength(1);
    expect(repo.subscriptions[0].currentPeriodEnd).toEqual(new Date("2028-10-23T00:00:00Z"));
  });

  it("issues a new API key on request and revokes the previous one", async () => {
    const repo = new FakePartnerRepo();
    const useCase = new ProvisionPartnerAccountUseCase(repo, audit);
    await useCase.execute(input());
    const again = await useCase.execute(input({ issueApiKey: true }));

    expect(again.apiKey).toMatch(/^pk_live_/);
    expect(repo.apiKeys.map((k) => k.isActive)).toEqual([false, true]);
    expect(repo.accounts[0].apiKeyId).toBe("key-2");
  });

  it("adopts a company already registered in Contapro when the owner is one of its users", async () => {
    const repo = new FakePartnerRepo();
    await repo.createCompany({ ...input().company, companyName: "El Roble", companyEmail: "x@y.com", municipality: null, address: null, phone: null, dv: null, adminFullName: "Ana", adminEmail: "ana@correo.com", adminPasswordHash: "h" });

    const result = await new ProvisionPartnerAccountUseCase(repo, audit).execute(input());

    expect(result).toMatchObject({ companyId: "co-1", created: false, temporaryPassword: null });
    expect(repo.companies).toHaveLength(1);
    expect(repo.apiKeys[0].createdByUserId).toBe("co-1-admin");
  });

  it("refuses to take over a company with that NIT when the owner is not one of its users", async () => {
    const repo = new FakePartnerRepo();
    await repo.createCompany({ ...input().company, companyName: "Otra", companyEmail: "x@y.com", municipality: null, address: null, phone: null, dv: null, adminFullName: "Luis", adminEmail: "luis@otra.com", adminPasswordHash: "h" });

    await expect(new ProvisionPartnerAccountUseCase(repo, audit).execute(input())).rejects.toThrow(/no es usuario/);
    expect(repo.accounts).toHaveLength(0);
    expect(repo.apiKeys).toHaveLength(0);
  });
});
