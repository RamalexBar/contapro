import { describe, expect, it } from "vitest";
import { tenantStorage } from "../../../../../shared/context/request-context";
import { AuditService } from "../../../../audit/application/audit.service";
import type { AuditLogEntry, CreateAuditLogInput, IAuditLogRepository } from "../../../../audit/domain/audit-log.repository";
import type { CreateOpportunityData, IOpportunityRepository, OpportunityRecord } from "../../domain/opportunity.repository";
import { CreateOpportunityUseCase } from "./create-opportunity.use-case";

class FakeOpportunityRepository implements Partial<IOpportunityRepository> {
  created: CreateOpportunityData[] = [];
  async create(data: CreateOpportunityData): Promise<OpportunityRecord> {
    this.created.push(data);
    const expectedValue = data.items.reduce((sum, i) => sum + i.unitPrice * i.quantity * (1 - i.discountPercent / 100), 0);
    return {
      id: "opp-1",
      branchId: data.branchId,
      customerId: data.customerId,
      ownerUserId: data.ownerUserId,
      title: data.title,
      description: data.description ?? null,
      stage: "PROSPECTO",
      expectedValue,
      expectedCloseDate: data.expectedCloseDate ?? null,
      lostReason: null,
      wonAt: null,
      lostAt: null,
      saleId: null,
      createdAt: new Date("2026-08-05"),
      items: data.items.map((item, i) => ({ id: `item-${i}`, ...item, total: item.unitPrice * item.quantity })),
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

function withTenantContext<T>(fn: () => Promise<T>, userId = "user-1"): Promise<T> {
  return tenantStorage.run({ companyId: "company-1", branchId: null, userId, roles: [], permissions: new Set() }, fn);
}

describe("CreateOpportunityUseCase", () => {
  it("defaults ownerUserId to the authenticated user when omitted", async () => {
    const repo = new FakeOpportunityRepository();
    const useCase = new CreateOpportunityUseCase(repo as unknown as IOpportunityRepository, new AuditService(new FakeAuditLogRepository()));

    await withTenantContext(
      () =>
        useCase.execute({
          branchId: "branch-1",
          customerId: "customer-1",
          title: "Venta de arroz",
          items: [{ productId: "product-1", quantity: 2, unitPrice: 50_000, discountPercent: 0 }],
        }),
      "user-42"
    );

    expect(repo.created[0].ownerUserId).toBe("user-42");
  });

  it("respects an explicit ownerUserId", async () => {
    const repo = new FakeOpportunityRepository();
    const useCase = new CreateOpportunityUseCase(repo as unknown as IOpportunityRepository, new AuditService(new FakeAuditLogRepository()));

    await withTenantContext(() =>
      useCase.execute({
        branchId: "branch-1",
        customerId: "customer-1",
        ownerUserId: "seller-99",
        title: "Venta de arroz",
        items: [{ productId: "product-1", quantity: 2, unitPrice: 50_000, discountPercent: 0 }],
      })
    );

    expect(repo.created[0].ownerUserId).toBe("seller-99");
  });

  it("records an OPPORTUNITY_CREATED audit entry", async () => {
    const repo = new FakeOpportunityRepository();
    const auditRepo = new FakeAuditLogRepository();
    const useCase = new CreateOpportunityUseCase(repo as unknown as IOpportunityRepository, new AuditService(auditRepo));

    await withTenantContext(() =>
      useCase.execute({
        branchId: "branch-1",
        customerId: "customer-1",
        title: "Venta de arroz",
        items: [{ productId: "product-1", quantity: 2, unitPrice: 50_000, discountPercent: 0 }],
      })
    );

    expect(auditRepo.entries[0]).toMatchObject({ action: "OPPORTUNITY_CREATED", entityId: "opp-1" });
  });
});
