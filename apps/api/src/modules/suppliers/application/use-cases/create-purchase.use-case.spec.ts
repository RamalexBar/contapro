import { describe, expect, it, vi } from "vitest";
import { tenantStorage } from "../../../../shared/context/request-context";
import { AuditService } from "../../../audit/application/audit.service";
import type { AuditLogEntry, CreateAuditLogInput, IAuditLogRepository } from "../../../audit/domain/audit-log.repository";
import type { PostPurchaseJournalEntryUseCase, PurchaseJournalEntryInput } from "../../../accounting/application/use-cases/post-purchase-journal-entry.use-case";
import type { GenerateElectronicSupportDocumentUseCase } from "../../../electronic-invoicing/application/use-cases/generate-electronic-support-document.use-case";
import type { IWithholdingConceptRepository, WithholdingConceptRecord } from "../../../accounting/domain/withholding-concept.repository";
import type { ISupplierRepository, SupplierRecord } from "../../domain/supplier.repository";
import type { ComputedPurchaseWithholding, IPurchaseRepository, PurchaseRecord } from "../../domain/purchase.repository";
import { CreatePurchaseUseCase, type CreatePurchaseInput } from "./create-purchase.use-case";

const SUPPLIER: SupplierRecord = {
  id: "supplier-1",
  name: "Distribuidora XYZ",
  nit: "900123456",
  contactName: null,
  phone: null,
  email: null,
  address: null,
  isActive: true,
  isObligatedToInvoice: true,
  documentType: "NIT",
  municipalityCode: null,
};

class FakeSupplierRepository implements Partial<ISupplierRepository> {
  async findByIdOrThrow(id: string): Promise<SupplierRecord> {
    if (id !== SUPPLIER.id) throw new Error("not found");
    return SUPPLIER;
  }
}

const RETEICA_CONCEPT: WithholdingConceptRecord = {
  id: "concept-reteica",
  code: "ICA-GENERAL",
  name: "ICA",
  type: "RETEICA",
  ratePercent: 1,
  isActive: true,
  dianConceptCode: null,
};

class FakeWithholdingConceptRepository implements Partial<IWithholdingConceptRepository> {
  constructor(private readonly concepts: WithholdingConceptRecord[] = [RETEICA_CONCEPT]) {}
  async findByIdOrThrow(id: string): Promise<WithholdingConceptRecord> {
    const concept = this.concepts.find((c) => c.id === id);
    if (!concept) throw new Error("not found");
    return concept;
  }
}

class FakePurchaseRepository implements Partial<IPurchaseRepository> {
  created: Array<{ retentionTotal: number; withholdings: ComputedPurchaseWithholding[]; currency: string; exchangeRate: number }> = [];
  async create(data: {
    branchId: string;
    supplierId: string;
    invoiceNumber: string;
    subtotal: number;
    taxTotal: number;
    total: number;
    dueDate: Date;
    retentionTotal: number;
    withholdings: ComputedPurchaseWithholding[];
    currency: string;
    exchangeRate: number;
  }): Promise<PurchaseRecord> {
    this.created.push({ retentionTotal: data.retentionTotal, withholdings: data.withholdings, currency: data.currency, exchangeRate: data.exchangeRate });
    return {
      id: "purchase-1",
      branchId: data.branchId,
      supplierId: data.supplierId,
      invoiceNumber: data.invoiceNumber,
      subtotal: data.subtotal,
      taxTotal: data.taxTotal,
      total: data.total,
      retentionTotal: data.retentionTotal,
      withholdings: data.withholdings,
      status: "REGISTERED",
      createdAt: new Date("2026-08-05"),
      accountPayableId: "ap-1",
      dueDate: data.dueDate,
      journalEntryId: null,
      currency: data.currency,
      exchangeRate: data.exchangeRate,
      foreignTotal: data.currency === "COP" ? null : data.total / data.exchangeRate,
    };
  }
  async setJournalEntryId(): Promise<void> {
    return;
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

function makeUseCase(concepts?: WithholdingConceptRecord[]) {
  const purchaseRepo = new FakePurchaseRepository();
  const postPurchaseJournalEntry = { execute: vi.fn().mockResolvedValue(null) } as unknown as PostPurchaseJournalEntryUseCase & {
    execute: (input: PurchaseJournalEntryInput) => Promise<null>;
  };
  const generateElectronicSupportDocument = {
    execute: vi.fn().mockResolvedValue(undefined),
  } as unknown as GenerateElectronicSupportDocumentUseCase;
  const auditRepo = new FakeAuditLogRepository();

  const useCase = new CreatePurchaseUseCase(
    purchaseRepo as unknown as IPurchaseRepository,
    new FakeSupplierRepository() as unknown as ISupplierRepository,
    new FakeWithholdingConceptRepository(concepts) as unknown as IWithholdingConceptRepository,
    postPurchaseJournalEntry,
    generateElectronicSupportDocument,
    new AuditService(auditRepo)
  );

  return { useCase, purchaseRepo, postPurchaseJournalEntry };
}

const BASE_INPUT: CreatePurchaseInput = {
  branchId: "branch-1",
  supplierId: SUPPLIER.id,
  invoiceNumber: "F-1",
  subtotal: 100_000,
  taxTotal: 19_000,
  total: 119_000,
  dueDate: new Date("2026-09-05"),
  withholdings: [],
  currency: "COP",
  exchangeRate: 1,
};

describe("CreatePurchaseUseCase — retenciones", () => {
  it("registers a purchase with no withholdings unaffected", async () => {
    const { useCase, purchaseRepo } = makeUseCase();

    await withTenantContext(() => useCase.execute(BASE_INPUT));

    expect(purchaseRepo.created[0].retentionTotal).toBe(0);
    expect(purchaseRepo.created[0].withholdings).toEqual([]);
  });

  it("computes the retained amount and passes it through to the AccountPayable creation and the journal entry", async () => {
    const { useCase, purchaseRepo, postPurchaseJournalEntry } = makeUseCase();

    const purchase = await withTenantContext(() =>
      useCase.execute({ ...BASE_INPUT, withholdings: [{ withholdingConceptId: RETEICA_CONCEPT.id, base: 100_000 }] })
    );

    expect(purchase.retentionTotal).toBe(1_000);
    expect(purchaseRepo.created[0]).toMatchObject({
      retentionTotal: 1_000,
      withholdings: [{ withholdingConceptId: RETEICA_CONCEPT.id, type: "RETEICA", base: 100_000, ratePercent: 1, amount: 1_000 }],
    });
    expect(postPurchaseJournalEntry.execute).toHaveBeenCalledWith(
      expect.objectContaining({ retentionTotal: 1_000, withholdingsByType: { RETEFUENTE: 0, RETEICA: 1_000, RETEIVA: 0 } })
    );
  });

  it("rejects an inactive withholding concept", async () => {
    const { useCase } = makeUseCase([{ ...RETEICA_CONCEPT, isActive: false }]);

    await expect(
      withTenantContext(() =>
        useCase.execute({ ...BASE_INPUT, withholdings: [{ withholdingConceptId: RETEICA_CONCEPT.id, base: 100_000 }] })
      )
    ).rejects.toThrow(/inactivo/);
  });

  it("rejects a retention base greater than the purchase's subtotal", async () => {
    const { useCase } = makeUseCase();

    await expect(
      withTenantContext(() =>
        useCase.execute({ ...BASE_INPUT, withholdings: [{ withholdingConceptId: RETEICA_CONCEPT.id, base: 500_000 }] })
      )
    ).rejects.toThrow(/no puede superar el subtotal/);
  });

  it("rejects when subtotal + taxTotal doesn't match total, before touching retention logic", async () => {
    const { useCase } = makeUseCase();

    await expect(withTenantContext(() => useCase.execute({ ...BASE_INPUT, total: 999_999 }))).rejects.toThrow(
      /no coincide con subtotal/
    );
  });
});

describe("CreatePurchaseUseCase — multi-moneda informativa (item 33 de docs/ALCANCE.md)", () => {
  it("defaults to COP/1 and computes the exact same COP totals as before this feature existed", async () => {
    const { useCase, purchaseRepo } = makeUseCase();

    const purchase = await withTenantContext(() => useCase.execute(BASE_INPUT));

    expect(purchase.currency).toBe("COP");
    expect(purchase.exchangeRate).toBe(1);
    expect(purchase.foreignTotal).toBeNull();
    expect(purchaseRepo.created[0].currency).toBe("COP");
    expect(purchaseRepo.created[0].exchangeRate).toBe(1);
    expect(purchase.total).toBe(119_000);
  });

  it("passes a non-COP currency/exchangeRate through to the repo without altering the COP totals", async () => {
    const { useCase, purchaseRepo } = makeUseCase();

    const purchase = await withTenantContext(() =>
      useCase.execute({ ...BASE_INPUT, currency: "USD", exchangeRate: 4200 })
    );

    expect(purchaseRepo.created[0].currency).toBe("USD");
    expect(purchaseRepo.created[0].exchangeRate).toBe(4200);
    expect(purchase.total).toBe(119_000);
  });
});
