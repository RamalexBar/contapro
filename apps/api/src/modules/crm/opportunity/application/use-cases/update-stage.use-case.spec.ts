import { describe, expect, it } from "vitest";
import { tenantStorage } from "../../../../../shared/context/request-context";
import { AuditService } from "../../../../audit/application/audit.service";
import type { AuditLogEntry, CreateAuditLogInput, IAuditLogRepository } from "../../../../audit/domain/audit-log.repository";
import type {
  CreateOpportunityData,
  IOpportunityRepository,
  OpportunityRecord,
  UpdateOpportunityStageData,
} from "../../domain/opportunity.repository";
import { UpdateStageUseCase } from "./update-stage.use-case";

function makeOpportunity(overrides: Partial<OpportunityRecord> = {}): OpportunityRecord {
  return {
    id: "opp-1",
    branchId: "branch-1",
    customerId: "customer-1",
    ownerUserId: "user-1",
    title: "Venta de arroz al por mayor",
    description: null,
    stage: "PROSPECTO",
    expectedValue: 100_000,
    expectedCloseDate: null,
    lostReason: null,
    wonAt: null,
    lostAt: null,
    saleId: null,
    createdAt: new Date("2026-08-01"),
    items: [{ id: "item-1", productId: "product-1", quantity: 2, unitPrice: 50_000, discountPercent: 0, total: 100_000 }],
    ...overrides,
  };
}

class FakeOpportunityRepository implements Partial<IOpportunityRepository> {
  updates: Array<{ id: string; data: UpdateOpportunityStageData }> = [];
  constructor(private opportunity: OpportunityRecord) {}

  async create(_data: CreateOpportunityData): Promise<OpportunityRecord> {
    return this.opportunity;
  }

  async findByIdOrThrow(id: string): Promise<OpportunityRecord> {
    if (id !== this.opportunity.id) throw new Error("not found");
    return this.opportunity;
  }

  async updateStage(id: string, data: UpdateOpportunityStageData): Promise<OpportunityRecord> {
    this.updates.push({ id, data });
    this.opportunity = { ...this.opportunity, ...data };
    return this.opportunity;
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
  return tenantStorage.run(
    { companyId: "company-1", branchId: null, userId: "user-2", roles: [], permissions: new Set() },
    fn
  );
}

function makeUseCase(opportunity: OpportunityRecord) {
  const repo = new FakeOpportunityRepository(opportunity);
  const auditRepo = new FakeAuditLogRepository();
  const useCase = new UpdateStageUseCase(repo as unknown as IOpportunityRepository, new AuditService(auditRepo));
  return { useCase, repo, auditRepo };
}

describe("UpdateStageUseCase", () => {
  it("moves forward between open stages and audits the change", async () => {
    const { useCase, auditRepo } = makeUseCase(makeOpportunity({ stage: "PROSPECTO" }));

    const updated = await withTenantContext(() => useCase.execute({ opportunityId: "opp-1", stage: "CONTACTO" }));

    expect(updated.stage).toBe("CONTACTO");
    expect(auditRepo.entries[0]).toMatchObject({
      action: "OPPORTUNITY_STAGE_CHANGED",
      metadata: { fromStage: "PROSPECTO", toStage: "CONTACTO" },
    });
  });

  it("moves backward between open stages freely", async () => {
    const { useCase } = makeUseCase(makeOpportunity({ stage: "NEGOCIACION" }));

    const updated = await withTenantContext(() => useCase.execute({ opportunityId: "opp-1", stage: "CONTACTO" }));

    expect(updated.stage).toBe("CONTACTO");
  });

  it("rejects marking PERDIDA without a reason", async () => {
    const { useCase } = makeUseCase(makeOpportunity({ stage: "PROPUESTA" }));

    await expect(
      withTenantContext(() => useCase.execute({ opportunityId: "opp-1", stage: "PERDIDA" }))
    ).rejects.toThrow(/motivo/);
  });

  it("marks PERDIDA with a reason and sets lostAt", async () => {
    const { useCase } = makeUseCase(makeOpportunity({ stage: "PROPUESTA" }));

    const updated = await withTenantContext(() =>
      useCase.execute({ opportunityId: "opp-1", stage: "PERDIDA", lostReason: "El cliente eligio otro proveedor" })
    );

    expect(updated.stage).toBe("PERDIDA");
    expect(updated.lostReason).toBe("El cliente eligio otro proveedor");
    expect(updated.lostAt).toBeInstanceOf(Date);
  });

  it("rejects any stage change once the opportunity is GANADA", async () => {
    const { useCase } = makeUseCase(makeOpportunity({ stage: "GANADA", saleId: "sale-1" }));

    await expect(
      withTenantContext(() => useCase.execute({ opportunityId: "opp-1", stage: "CONTACTO" }))
    ).rejects.toThrow(/cerrada/);
  });

  it("rejects any stage change once the opportunity is PERDIDA", async () => {
    const { useCase } = makeUseCase(makeOpportunity({ stage: "PERDIDA", lostReason: "Precio" }));

    await expect(
      withTenantContext(() => useCase.execute({ opportunityId: "opp-1", stage: "CONTACTO" }))
    ).rejects.toThrow(/cerrada/);
  });

  it("rejects setting GANADA directly -- must go through CloseOpportunityAsWonUseCase", async () => {
    const { useCase } = makeUseCase(makeOpportunity({ stage: "NEGOCIACION" }));

    await expect(
      withTenantContext(() => useCase.execute({ opportunityId: "opp-1", stage: "GANADA" }))
    ).rejects.toThrow(/win/);
  });
});
