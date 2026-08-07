import { describe, expect, it, vi } from "vitest";
import { tenantStorage } from "../../../../shared/context/request-context";
import { AuditService } from "../../../audit/application/audit.service";
import type { AuditLogEntry, CreateAuditLogInput, IAuditLogRepository } from "../../../audit/domain/audit-log.repository";
import type { IProductRepository } from "../../../inventory/product/domain/product.repository";
import { Product } from "../../../inventory/product/domain/product.entity";
import type { IPriceListRepository } from "../../../inventory/price-list/domain/price-list.repository";
import type { CreateSaleUseCase } from "../../../pos/sale/application/use-cases/create-sale.use-case";
import type {
  AdvanceNextRunData,
  CreateRecurringInvoiceData,
  IRecurringInvoiceRepository,
  RecordRunData,
  RecurringInvoiceRecord,
  RecurringInvoiceRunRecord,
  UpdateRecurringInvoiceData,
} from "../../domain/recurring-invoice.repository";
import { RunRecurringInvoicesUseCase } from "./run-recurring-invoices.use-case";

const PRODUCT = Product.fromPersistence({
  id: "product-1",
  companyId: "company-1",
  sku: "SKU-1",
  name: "Mantenimiento mensual",
  description: null,
  categoryId: null,
  brandId: null,
  unit: "UN",
  currentCost: 3000,
  currentPrice: 5000,
  taxRate: 19,
  isActive: true,
});

class FakeProductRepository implements Partial<IProductRepository> {
  async findByIdOrThrow(id: string) {
    if (id !== PRODUCT.id) throw new Error(`producto ${id} no encontrado`);
    return PRODUCT;
  }
}

class FakePriceListRepository implements Partial<IPriceListRepository> {
  async findProductPrice(): Promise<number | null> {
    throw new Error("no deberia consultarse: las plantillas de este test no tienen priceListId");
  }
}

function makeInvoice(overrides: Partial<RecurringInvoiceRecord> = {}): RecurringInvoiceRecord {
  return {
    id: "ri-1",
    customerId: "customer-1",
    branchId: "branch-1",
    name: "Mantenimiento",
    dayOfMonth: 6,
    priceListId: null,
    dueDays: 30,
    isActive: true,
    nextRunDate: new Date(2026, 7, 6),
    lastRunDate: null,
    items: [{ productId: PRODUCT.id, quantity: 2 }],
    createdAt: new Date(2026, 6, 1),
    ...overrides,
  };
}

class FakeRecurringInvoiceRepository implements Partial<IRecurringInvoiceRepository> {
  due: RecurringInvoiceRecord[] = [];
  runs: RecordRunData[] = [];
  advanced: { id: string; data: AdvanceNextRunData }[] = [];

  async listDue(): Promise<RecurringInvoiceRecord[]> {
    return this.due;
  }
  async recordRun(data: RecordRunData): Promise<RecurringInvoiceRunRecord> {
    this.runs.push(data);
    return { id: `run-${this.runs.length}`, saleId: data.saleId ?? null, errorMessage: data.errorMessage ?? null, createdAt: new Date(), ...data };
  }
  async advanceNextRun(id: string, data: AdvanceNextRunData): Promise<void> {
    this.advanced.push({ id, data });
  }
  create(_data: CreateRecurringInvoiceData): Promise<RecurringInvoiceRecord> {
    throw new Error("not used in this spec");
  }
  update(_id: string, _data: UpdateRecurringInvoiceData): Promise<RecurringInvoiceRecord> {
    throw new Error("not used in this spec");
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

function makeUseCase(saleExecuteImpl: (input: unknown) => Promise<{ id: string; number: number }>) {
  const repo = new FakeRecurringInvoiceRepository();
  const auditRepo = new FakeAuditLogRepository();
  const createSaleUseCase = { execute: vi.fn(saleExecuteImpl) } as unknown as CreateSaleUseCase;

  const useCase = new RunRecurringInvoicesUseCase(
    repo as unknown as IRecurringInvoiceRepository,
    new FakeProductRepository() as unknown as IProductRepository,
    new FakePriceListRepository() as unknown as IPriceListRepository,
    createSaleUseCase,
    new AuditService(auditRepo)
  );

  return { useCase, repo, createSaleUseCase };
}

function withTenantContext<T>(fn: () => Promise<T>): Promise<T> {
  return tenantStorage.run(
    { companyId: "company-1", branchId: null, userId: "system", roles: [], permissions: new Set() },
    fn
  );
}

describe("RunRecurringInvoicesUseCase", () => {
  it("creates a CREDIT sale for the exact net total, records a SUCCESS run and advances nextRunDate", async () => {
    const { useCase, repo, createSaleUseCase } = makeUseCase(async () => ({ id: "sale-1", number: 42 }));
    repo.due = [makeInvoice()];

    await withTenantContext(() => useCase.execute());

    // subtotal = 5000 * 2 = 10000, IVA 19% = 1900, total = 11900
    expect(createSaleUseCase.execute).toHaveBeenCalledWith(
      expect.objectContaining({
        branchId: "branch-1",
        customerId: "customer-1",
        items: [{ productId: PRODUCT.id, quantity: 2, discountPercent: 0 }],
        payments: [{ method: "CREDIT", amount: 11_900 }],
        priceListId: undefined,
      })
    );
    expect(repo.runs).toEqual([{ recurringInvoiceId: "ri-1", runDate: expect.any(Date), status: "SUCCESS", saleId: "sale-1" }]);
    expect(repo.advanced).toHaveLength(1);
    expect(repo.advanced[0].id).toBe("ri-1");
    // dayOfMonth=6, nextRunDate previo = 2026-08-06 -> avanza a 2026-09-06 (nunca el mismo dia)
    expect(repo.advanced[0].data.nextRunDate).toEqual(new Date(2026, 8, 6));
  });

  it("records a FAILED run and does NOT advance nextRunDate when the sale fails", async () => {
    const { useCase, repo, createSaleUseCase } = makeUseCase(async () => {
      throw new Error("no deberia llegar aqui");
    });
    repo.due = [makeInvoice({ items: [{ productId: "product-inexistente", quantity: 1 }] })];

    await withTenantContext(() => useCase.execute());

    expect(createSaleUseCase.execute).not.toHaveBeenCalled();
    expect(repo.runs).toHaveLength(1);
    expect(repo.runs[0].status).toBe("FAILED");
    expect(repo.runs[0].errorMessage).toMatch(/no encontrado/);
    expect(repo.advanced).toHaveLength(0);
  });

  it("a failing template does not block a subsequent successful template", async () => {
    const { useCase, repo } = makeUseCase(async () => ({ id: "sale-2", number: 7 }));
    repo.due = [
      makeInvoice({ id: "ri-fail", items: [{ productId: "product-inexistente", quantity: 1 }] }),
      makeInvoice({ id: "ri-ok" }),
    ];

    await withTenantContext(() => useCase.execute());

    const statuses = repo.runs.map((r) => ({ id: r.recurringInvoiceId, status: r.status }));
    expect(statuses).toEqual([
      { id: "ri-fail", status: "FAILED" },
      { id: "ri-ok", status: "SUCCESS" },
    ]);
    expect(repo.advanced.map((a) => a.id)).toEqual(["ri-ok"]);
  });
});
