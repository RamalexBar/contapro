import { describe, expect, it, vi } from "vitest";
import { tenantStorage } from "../../../../../shared/context/request-context";
import { AuditService } from "../../../../audit/application/audit.service";
import type { AuditLogEntry, CreateAuditLogInput, IAuditLogRepository } from "../../../../audit/domain/audit-log.repository";
import type { CreateSaleUseCase } from "../../../../pos/sale/application/use-cases/create-sale.use-case";
import type { SaleRecord } from "../../../../pos/sale/domain/sale.repository";
import type {
  CreateOpportunityData,
  IOpportunityRepository,
  OpportunityRecord,
  UpdateOpportunityStageData,
} from "../../domain/opportunity.repository";
import { CloseOpportunityAsWonUseCase } from "./close-opportunity-as-won.use-case";

function makeOpportunity(overrides: Partial<OpportunityRecord> = {}): OpportunityRecord {
  return {
    id: "opp-1",
    branchId: "branch-1",
    customerId: "customer-1",
    ownerUserId: "user-1",
    title: "Venta de arroz al por mayor",
    description: null,
    stage: "NEGOCIACION",
    expectedValue: 100_000,
    expectedCloseDate: new Date("2026-09-01"),
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

const FAKE_SALE: SaleRecord = {
  id: "sale-1",
  companyId: "company-1",
  branchId: "branch-1",
  number: 42,
  customerId: "customer-1",
  sellerUserId: "user-1",
  status: "COMPLETED",
  paymentStatus: "CREDIT",
  subtotal: 100_000,
  discountTotal: 0,
  taxTotal: 0,
  total: 100_000,
  retentionTotal: 0,
  cufe: null,
  cude: null,
  invoiceXmlUrl: null,
  accountReceivableId: "ar-1",
  requestedReceivableDueDate: null,
  currency: "COP",
  exchangeRate: 1,
  foreignTotal: null,
  priceListId: null,
  createdAt: new Date("2026-08-05"),
  withholdings: [],
  items: [],
  payments: [{ method: "CREDIT", amount: 100_000 }],
  costTotal: 0,
};

function withTenantContext<T>(fn: () => Promise<T>): Promise<T> {
  return tenantStorage.run(
    { companyId: "company-1", branchId: null, userId: "user-2", roles: [], permissions: new Set() },
    fn
  );
}

function makeUseCase(opportunity: OpportunityRecord) {
  const repo = new FakeOpportunityRepository(opportunity);
  const createSaleUseCase = { execute: vi.fn().mockResolvedValue(FAKE_SALE) } as unknown as CreateSaleUseCase;
  const auditRepo = new FakeAuditLogRepository();
  const useCase = new CloseOpportunityAsWonUseCase(
    repo as unknown as IOpportunityRepository,
    createSaleUseCase,
    new AuditService(auditRepo)
  );
  return { useCase, repo, createSaleUseCase, auditRepo };
}

describe("CloseOpportunityAsWonUseCase", () => {
  it("closes as won with a CREDIT payment by default, mapping items without unitPrice", async () => {
    const { useCase, repo, createSaleUseCase, auditRepo } = makeUseCase(makeOpportunity());

    const result = await withTenantContext(() => useCase.execute({ opportunityId: "opp-1" }));

    expect(createSaleUseCase.execute).toHaveBeenCalledWith({
      branchId: "branch-1",
      customerId: "customer-1",
      items: [{ productId: "product-1", quantity: 2, discountPercent: 0 }],
      payments: [{ method: "CREDIT", amount: 100_000 }],
      withholdings: [],
      dueDate: new Date("2026-09-01"),
      currency: "COP",
      exchangeRate: 1,
    });
    expect(result.opportunity.stage).toBe("GANADA");
    expect(result.opportunity.saleId).toBe("sale-1");
    expect(result.opportunity.wonAt).toBeInstanceOf(Date);
    expect(repo.updates[0]).toMatchObject({ id: "opp-1", data: { stage: "GANADA", saleId: "sale-1" } });
    expect(auditRepo.entries[0]).toMatchObject({ action: "OPPORTUNITY_WON", entityId: "opp-1" });
  });

  it("overrides the payment method to CASH when requested", async () => {
    const { useCase, createSaleUseCase } = makeUseCase(makeOpportunity());

    await withTenantContext(() => useCase.execute({ opportunityId: "opp-1", paymentMethod: "CASH" }));

    expect(createSaleUseCase.execute).toHaveBeenCalledWith(
      expect.objectContaining({ payments: [{ method: "CASH", amount: 100_000 }] })
    );
  });

  it("rejects re-closing an already won opportunity", async () => {
    const { useCase } = makeUseCase(makeOpportunity({ stage: "GANADA", saleId: "sale-0" }));

    await expect(withTenantContext(() => useCase.execute({ opportunityId: "opp-1" }))).rejects.toThrow(
      /no puede volver a cerrarse/
    );
  });

  it("rejects re-closing an already lost opportunity", async () => {
    const { useCase } = makeUseCase(makeOpportunity({ stage: "PERDIDA", lostReason: "Precio" }));

    await expect(withTenantContext(() => useCase.execute({ opportunityId: "opp-1" }))).rejects.toThrow(
      /no puede volver a cerrarse/
    );
  });

  it("rejects closing an opportunity with no items", async () => {
    const { useCase } = makeUseCase(makeOpportunity({ items: [] }));

    await expect(withTenantContext(() => useCase.execute({ opportunityId: "opp-1" }))).rejects.toThrow(/no tiene items/);
  });
});
