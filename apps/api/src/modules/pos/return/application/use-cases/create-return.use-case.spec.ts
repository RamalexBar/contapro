import { describe, expect, it, vi } from "vitest";
import { tenantStorage } from "../../../../../shared/context/request-context";
import { AuditService } from "../../../../audit/application/audit.service";
import type { AuditLogEntry, CreateAuditLogInput, IAuditLogRepository } from "../../../../audit/domain/audit-log.repository";
import type { CreateSaleData, ISaleRepository, SaleRecord } from "../../../sale/domain/sale.repository";
import type { CreateReturnData, IReturnRepository, ReturnRecord } from "../../domain/return.repository";
import type {
  PostReturnJournalEntryUseCase,
  ReturnJournalEntryInput,
} from "../../../../accounting/application/use-cases/post-return-journal-entry.use-case";
import type { CreateCreditNoteUseCase, CreditNoteForReturnInput } from "../../../credit-note/application/use-cases/create-credit-note.use-case";
import { CreateReturnUseCase } from "./create-return.use-case";

const SALE: SaleRecord = {
  id: "sale-1",
  companyId: "company-1",
  branchId: "branch-1",
  number: 42,
  customerId: "customer-1",
  sellerUserId: "user-1",
  status: "COMPLETED",
  paymentStatus: "PAID",
  subtotal: 200_000,
  discountTotal: 0,
  taxTotal: 38_000,
  total: 238_000,
  retentionTotal: 0,
  cufe: null,
  cude: null,
  invoiceXmlUrl: null,
  accountReceivableId: null,
  requestedReceivableDueDate: null,
  currency: "COP",
  exchangeRate: 1,
  foreignTotal: null,
  priceListId: null,
  createdAt: new Date("2026-08-01T00:00:00.000Z"),
  withholdings: [],
  items: [
    {
      id: "sale-item-1",
      productId: "product-1",
      quantity: 2,
      unitPrice: 100_000,
      discountPercent: 0,
      taxPercent: 19,
      taxAmount: 38_000,
      total: 238_000,
      requiresDiscountAuthorization: false,
      discountAuthorizationId: null,
    },
  ],
  payments: [{ method: "CASH", amount: 238_000 }],
  costTotal: 120_000,
};

class FakeSaleRepository implements ISaleRepository {
  constructor(private readonly sale: SaleRecord = SALE) {}
  create(_data: CreateSaleData): Promise<SaleRecord> {
    throw new Error("not used in this spec");
  }
  async findByIdOrThrow(id: string): Promise<SaleRecord> {
    if (id !== this.sale.id) throw new Error("not found");
    return this.sale;
  }
  authorizeItemDiscount(): Promise<SaleRecord> {
    throw new Error("not used in this spec");
  }
  cancel(): Promise<SaleRecord> {
    throw new Error("not used in this spec");
  }
  list(): Promise<SaleRecord[]> {
    throw new Error("not used in this spec");
  }
  listForYear(): Promise<SaleRecord[]> {
    throw new Error("not used in this spec");
  }
  listForPeriod(): Promise<SaleRecord[]> {
    throw new Error("not used in this spec");
  }
}

class FakeReturnRepository implements IReturnRepository {
  created: CreateReturnData[] = [];
  constructor(private readonly saleStatusAfter = "RETURNED_PARTIAL") {}
  async create(data: CreateReturnData): Promise<ReturnRecord> {
    this.created.push(data);
    return {
      saleStatus: this.saleStatusAfter,
      id: `return-${this.created.length}`,
      branchId: data.branchId,
      saleId: data.saleId,
      customerId: data.customerId ?? null,
      reason: data.reason,
      status: "PENDING",
      total: data.total,
      createdAt: new Date("2026-08-02T00:00:00.000Z"),
      items: data.items.map((item, i) => ({ id: `return-item-${i}`, ...item })),
      // Costo fijo arbitrario por unidad restockeada (60_000, la mitad del unitPrice de SALE) --
      // distinto de cualquier otro monto para que un test pueda distinguirlo.
      costTotal: data.items.filter((i) => i.restockedToBranch).reduce((sum, i) => sum + i.quantity * 60_000, 0),
    };
  }
  list(): Promise<ReturnRecord[]> {
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

function withTenantContext<T>(fn: () => Promise<T>): Promise<T> {
  return tenantStorage.run(
    { companyId: "company-1", branchId: null, userId: "user-1", roles: [], permissions: new Set() },
    fn
  );
}

function makeUseCase(overrides: { sale?: SaleRecord; saleStatusAfter?: string } = {}) {
  const saleRepo = new FakeSaleRepository(overrides.sale);
  const returnRepo = new FakeReturnRepository(overrides.saleStatusAfter);
  const auditRepo = new FakeAuditLogRepository();
  const postReturnJournalEntry = { execute: vi.fn() } as unknown as PostReturnJournalEntryUseCase & {
    execute: (input: ReturnJournalEntryInput) => Promise<null>;
  };
  postReturnJournalEntry.execute = vi.fn().mockResolvedValue(null);
  const creditNotes: CreditNoteForReturnInput[] = [];
  const createCreditNote = {
    executeForReturn: vi.fn(async (input: CreditNoteForReturnInput) => {
      creditNotes.push(input);
      return {} as never;
    }),
  } as unknown as CreateCreditNoteUseCase;
  const productReader = { findById: async () => ({ toProps: { name: "Licuadora" } }) };
  const useCase = new CreateReturnUseCase(returnRepo, saleRepo, postReturnJournalEntry, new AuditService(auditRepo), createCreditNote, productReader);
  return { useCase, returnRepo, auditRepo, postReturnJournalEntry, creditNotes };
}

describe("CreateReturnUseCase", () => {
  it("rejects a return on a sale that isn't COMPLETED or RETURNED_PARTIAL", async () => {
    const { useCase } = makeUseCase({ sale: { ...SALE, status: "CANCELLED" } });

    await expect(
      withTenantContext(() =>
        useCase.execute({
          saleId: SALE.id,
          reason: "Producto defectuoso",
          refundMethod: "CASH",
          items: [{ saleItemId: "sale-item-1", quantity: 1, restockedToBranch: true }],
        })
      )
    ).rejects.toThrow(/estado CANCELLED/);
  });

  it("rejects a saleItemId that doesn't belong to the sale", async () => {
    const { useCase } = makeUseCase();

    await expect(
      withTenantContext(() =>
        useCase.execute({
          saleId: SALE.id,
          reason: "Producto defectuoso",
          refundMethod: "CASH",
          items: [{ saleItemId: "not-a-real-item", quantity: 1, restockedToBranch: true }],
        })
      )
    ).rejects.toThrow(/no pertenece a la venta/);
  });

  it("rejects a quantity of zero or less", async () => {
    const { useCase } = makeUseCase();

    await expect(
      withTenantContext(() =>
        useCase.execute({
          saleId: SALE.id,
          reason: "Producto defectuoso",
          refundMethod: "CASH",
          items: [{ saleItemId: "sale-item-1", quantity: 0, restockedToBranch: true }],
        })
      )
    ).rejects.toThrow(/mayor a cero/);
  });

  it("computes subtotal/tax/total from the real SaleItem and posts audit + accounting", async () => {
    const { useCase, returnRepo, auditRepo, postReturnJournalEntry } = makeUseCase();

    const result = await withTenantContext(() =>
      useCase.execute({
        saleId: SALE.id,
        reason: "Producto defectuoso",
        refundMethod: "CASH",
        items: [{ saleItemId: "sale-item-1", quantity: 1, restockedToBranch: true }],
      })
    );

    // 1 unidad de 2 vendidas a 100_000 c/u + 19% IVA
    expect(returnRepo.created).toEqual([
      expect.objectContaining({
        branchId: "branch-1",
        saleId: "sale-1",
        total: 119_000,
        items: [
          expect.objectContaining({
            saleItemId: "sale-item-1",
            productId: "product-1",
            quantity: 1,
            unitPrice: 100_000,
            total: 119_000,
            restockedToBranch: true,
          }),
        ],
      }),
    ]);

    expect(auditRepo.entries).toEqual([expect.objectContaining({ action: "RETURN_CREATED" })]);
    expect(postReturnJournalEntry.execute).toHaveBeenCalledWith(
      expect.objectContaining({ subtotal: 100_000, taxTotal: 19_000, total: 119_000, refundMethod: "CASH", costOfGoodsSold: 60_000 })
    );
    expect(result.id).toBe("return-1");
  });

  it("refunds the discounted price, not the list price, of an item sold with a discount", async () => {
    const discounted: SaleRecord = {
      ...SALE,
      discountTotal: 20_000,
      taxTotal: 34_200,
      total: 214_200,
      items: [{ ...SALE.items[0]!, discountPercent: 10, taxAmount: 34_200, total: 214_200 }],
    };
    const { useCase, returnRepo, postReturnJournalEntry, creditNotes } = makeUseCase({ sale: discounted });

    await withTenantContext(() =>
      useCase.execute({
        saleId: SALE.id,
        reason: "No le gusto",
        refundMethod: "CASH",
        items: [{ saleItemId: "sale-item-1", quantity: 1, restockedToBranch: true }],
      })
    );

    // 100.000 - 10 % = 90.000 de base + 17.100 de IVA = 107.100 (antes devolvia 119.000).
    expect(returnRepo.created[0]).toEqual(expect.objectContaining({ total: 107_100 }));
    expect(postReturnJournalEntry.execute).toHaveBeenCalledWith(expect.objectContaining({ subtotal: 90_000, taxTotal: 17_100, total: 107_100 }));
    expect(creditNotes[0]!.lines).toEqual([
      expect.objectContaining({ code: "ITEM-1", description: "Licuadora", quantity: 1, unitPrice: 100_000, discountPercent: 10, taxPercent: 19 }),
    ]);
    expect(creditNotes[0]!.amount).toBe(107_100);
  });

  it("issues a partial-return credit note (concept 1) with the refund payment method", async () => {
    const { useCase, creditNotes } = makeUseCase();

    await withTenantContext(() =>
      useCase.execute({
        saleId: SALE.id,
        reason: "Producto defectuoso",
        refundMethod: "TRANSFER",
        items: [{ saleItemId: "sale-item-1", quantity: 1, restockedToBranch: true }],
      })
    );

    expect(creditNotes).toEqual([
      expect.objectContaining({
        returnId: "return-1",
        saleId: "sale-1",
        customerId: "customer-1",
        conceptCode: "1",
        amount: 119_000,
        paymentMethodCode: "47",
      }),
    ]);
  });

  it("uses concept 2 (anulacion) when a single return gives back the whole sale", async () => {
    const { useCase, creditNotes } = makeUseCase({ saleStatusAfter: "RETURNED_FULL" });

    await withTenantContext(() =>
      useCase.execute({
        saleId: SALE.id,
        reason: "Se arrepintio",
        refundMethod: "CASH",
        items: [{ saleItemId: "sale-item-1", quantity: 2, restockedToBranch: true }],
      })
    );

    expect(creditNotes[0]).toEqual(expect.objectContaining({ conceptCode: "2", amount: 238_000 }));
  });
});
