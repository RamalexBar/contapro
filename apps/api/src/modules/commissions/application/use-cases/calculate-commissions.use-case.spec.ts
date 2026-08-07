import { describe, expect, it } from "vitest";
import { tenantStorage } from "../../../../shared/context/request-context";
import { AuditService } from "../../../audit/application/audit.service";
import type { AuditLogEntry, CreateAuditLogInput, IAuditLogRepository } from "../../../audit/domain/audit-log.repository";
import type { ISaleRepository, SaleRecord } from "../../../pos/sale/domain/sale.repository";
import type { ISalesCommissionSchemeRepository, SalesCommissionSchemeRecord } from "../../domain/sales-commission-scheme.repository";
import type {
  CommissionSettlementRecord,
  ICommissionSettlementRepository,
  UpsertSettlementForPeriodData,
} from "../../domain/commission-settlement.repository";
import { CalculateCommissionsUseCase } from "./calculate-commissions.use-case";

function makeSale(overrides: Partial<SaleRecord>): SaleRecord {
  return {
    id: "sale-1",
    companyId: "company-1",
    branchId: "branch-1",
    number: 1,
    customerId: null,
    sellerUserId: "seller-1",
    status: "COMPLETED",
    paymentStatus: "PAID",
    subtotal: 100_000,
    discountTotal: 0,
    taxTotal: 19_000,
    total: 119_000,
    retentionTotal: 0,
    cufe: null,
    cude: null,
    invoiceXmlUrl: null,
    createdAt: new Date(2026, 5, 1),
    accountReceivableId: null,
    currency: "COP",
    exchangeRate: 1,
    foreignTotal: null,
    priceListId: null,
    withholdings: [],
    items: [],
    payments: [],
    ...overrides,
  };
}

class FakeSaleRepository implements Partial<ISaleRepository> {
  constructor(private readonly sales: SaleRecord[]) {}
  async listForPeriod(year: number, month: number): Promise<SaleRecord[]> {
    return this.sales.filter((s) => s.createdAt.getFullYear() === year && s.createdAt.getMonth() === month - 1);
  }
}

function makeScheme(overrides: Partial<SalesCommissionSchemeRecord>): SalesCommissionSchemeRecord {
  return { id: "scheme-1", sellerUserId: "seller-1", ratePercent: 5, isActive: true, ...overrides };
}

class FakeSchemeRepository implements Partial<ISalesCommissionSchemeRepository> {
  constructor(private readonly schemes: SalesCommissionSchemeRecord[]) {}
  async listActive(): Promise<SalesCommissionSchemeRecord[]> {
    return this.schemes.filter((s) => s.isActive);
  }
}

class FakeSettlementRepository implements Partial<ICommissionSettlementRepository> {
  upserted: UpsertSettlementForPeriodData[] = [];
  paidSellers = new Set<string>();

  async upsertForPeriod(data: UpsertSettlementForPeriodData): Promise<CommissionSettlementRecord | null> {
    this.upserted.push(data);
    if (this.paidSellers.has(data.sellerUserId)) return null;
    return {
      id: `settlement-${data.sellerUserId}`,
      sellerUserId: data.sellerUserId,
      year: data.year,
      month: data.month,
      salesBase: data.salesBase,
      ratePercent: data.ratePercent,
      commissionAmount: data.commissionAmount,
      status: "CALCULATED",
      calculatedAt: new Date(),
      paidAt: null,
      journalEntryId: null,
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

function withTenantContext<T>(fn: () => Promise<T>): Promise<T> {
  return tenantStorage.run(
    { companyId: "company-1", branchId: null, userId: "user-1", roles: [], permissions: new Set() },
    fn
  );
}

function makeUseCase(sales: SaleRecord[], schemes: SalesCommissionSchemeRecord[]) {
  const saleRepo = new FakeSaleRepository(sales);
  const schemeRepo = new FakeSchemeRepository(schemes);
  const settlementRepo = new FakeSettlementRepository();
  const auditRepo = new FakeAuditLogRepository();
  const useCase = new CalculateCommissionsUseCase(
    saleRepo as unknown as ISaleRepository,
    schemeRepo as unknown as ISalesCommissionSchemeRepository,
    settlementRepo as unknown as ICommissionSettlementRepository,
    new AuditService(auditRepo)
  );
  return { useCase, settlementRepo };
}

describe("CalculateCommissionsUseCase", () => {
  it("aggregates sales subtotal per seller and applies each scheme's rate", async () => {
    const sales = [
      makeSale({ id: "s1", sellerUserId: "seller-1", subtotal: 100_000, createdAt: new Date(2026, 5, 1) }),
      makeSale({ id: "s2", sellerUserId: "seller-1", subtotal: 50_000, createdAt: new Date(2026, 5, 15) }),
      makeSale({ id: "s3", sellerUserId: "seller-2", subtotal: 20_000, createdAt: new Date(2026, 5, 2) }),
    ];
    const schemes = [makeScheme({ sellerUserId: "seller-1", ratePercent: 5 }), makeScheme({ id: "scheme-2", sellerUserId: "seller-2", ratePercent: 10 })];
    const { useCase } = makeUseCase(sales, schemes);

    const results = await withTenantContext(() => useCase.execute(2026, 6));

    expect(results).toHaveLength(2);
    const seller1 = results.find((r) => r.sellerUserId === "seller-1")!;
    expect(seller1.salesBase).toBe(150_000);
    expect(seller1.commissionAmount).toBe(7500);
    const seller2 = results.find((r) => r.sellerUserId === "seller-2")!;
    expect(seller2.salesBase).toBe(20_000);
    expect(seller2.commissionAmount).toBe(2000);
  });

  it("excludes sales from other months when computing the base", async () => {
    const sales = [
      makeSale({ id: "s-may", sellerUserId: "seller-1", subtotal: 999_999, createdAt: new Date(2026, 4, 1) }),
      makeSale({ id: "s-june", sellerUserId: "seller-1", subtotal: 100_000, createdAt: new Date(2026, 5, 1) }),
    ];
    const { useCase } = makeUseCase(sales, [makeScheme({ sellerUserId: "seller-1", ratePercent: 5 })]);

    const results = await withTenantContext(() => useCase.execute(2026, 6));

    expect(results).toEqual([expect.objectContaining({ sellerUserId: "seller-1", salesBase: 100_000 })]);
  });

  it("skips a seller with an active scheme but no sales that period", async () => {
    const sales = [makeSale({ sellerUserId: "seller-1", createdAt: new Date(2026, 5, 1) })];
    const schemes = [makeScheme({ sellerUserId: "seller-1" }), makeScheme({ id: "scheme-3", sellerUserId: "seller-3" })];
    const { useCase, settlementRepo } = makeUseCase(sales, schemes);

    const results = await withTenantContext(() => useCase.execute(2026, 6));

    expect(results.find((r) => r.sellerUserId === "seller-3")).toBeUndefined();
    expect(settlementRepo.upserted.find((u) => u.sellerUserId === "seller-3")).toBeUndefined();
  });

  it("does not overwrite an already PAID settlement", async () => {
    const sales = [makeSale({ sellerUserId: "seller-1", subtotal: 100_000, createdAt: new Date(2026, 5, 1) })];
    const { useCase, settlementRepo } = makeUseCase(sales, [makeScheme({ sellerUserId: "seller-1" })]);
    settlementRepo.paidSellers.add("seller-1");

    const results = await withTenantContext(() => useCase.execute(2026, 6));

    expect(results).toHaveLength(0);
    // Igual intento recalcular (el repo es quien decide no pisar el PAID, no el use case).
    expect(settlementRepo.upserted).toHaveLength(1);
  });
});
