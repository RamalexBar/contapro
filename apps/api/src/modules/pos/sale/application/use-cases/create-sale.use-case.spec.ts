import { describe, expect, it, vi } from "vitest";
import { tenantStorage } from "../../../../../shared/context/request-context";
import { AuditService } from "../../../../audit/application/audit.service";
import type { AuditLogEntry, CreateAuditLogInput, IAuditLogRepository } from "../../../../audit/domain/audit-log.repository";
import type { PostSaleJournalEntryUseCase, SaleJournalEntryInput } from "../../../../accounting/application/use-cases/post-sale-journal-entry.use-case";
import type { GenerateElectronicInvoiceUseCase } from "../../../../electronic-invoicing/application/use-cases/generate-electronic-invoice.use-case";
import type { WebhookDispatcherService } from "../../../../webhooks/application/webhook-dispatcher.service";
import type { SendInvoiceWhatsAppUseCase } from "../../../../electronic-invoicing/application/use-cases/send-invoice-whatsapp.use-case";
import type { IWithholdingConceptRepository, WithholdingConceptRecord } from "../../../../accounting/domain/withholding-concept.repository";
import type { IProductRepository } from "../../../../inventory/product/domain/product.repository";
import { Product } from "../../../../inventory/product/domain/product.entity";
import type { ICustomerRepository, CustomerRecord } from "../../../../customers/domain/customer.repository";
import type { IPriceListRepository, PriceListRecord } from "../../../../inventory/price-list/domain/price-list.repository";
import type { IDiscountLimitRepository } from "../../domain/discount-limit.repository";
import type { CreateSaleData, ISaleRepository, SaleRecord } from "../../domain/sale.repository";
import { CreateSaleUseCase } from "./create-sale.use-case";

const PRODUCT = Product.fromPersistence({
  id: "product-1",
  companyId: "company-1",
  sku: "SKU-1",
  name: "Arroz 500g",
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
    if (id !== PRODUCT.id) throw new Error("not found");
    return PRODUCT;
  }
}

class FakeDiscountLimitRepository implements IDiscountLimitRepository {
  async getMaxDiscountPercent(): Promise<number | null> {
    return 0;
  }
}

const CUSTOMER_NO_LIST: CustomerRecord = {
  id: "customer-1",
  documentType: "CC",
  documentNumber: "123",
  name: "Cliente sin lista",
  email: null,
  phone: null,
  creditLimit: 0,
  currentBalance: 0,
  isActive: true,
  priceListId: null,
  municipalityCode: null,
  address: null,
  dianIdentityDocumentId: null,
  dianTypeOrganizationId: null,
  dianTaxRegimeId: null,
  dianTaxLevelId: null,
  dianCountryId: null,
  dianCityId: null,
  dianPostalCode: null,
};

const CUSTOMER_WITH_LIST: CustomerRecord = { ...CUSTOMER_NO_LIST, id: "customer-2", name: "Cliente mayorista", priceListId: "pl-wholesale" };

class FakeCustomerRepository implements Partial<ICustomerRepository> {
  private customers = [CUSTOMER_NO_LIST, CUSTOMER_WITH_LIST];
  async findByIdOrThrow(id: string): Promise<CustomerRecord> {
    const found = this.customers.find((c) => c.id === id);
    if (!found) throw new Error("not found");
    return found;
  }
}

const WHOLESALE_LIST: PriceListRecord = { id: "pl-wholesale", code: "MAYORISTA", name: "Mayorista", isActive: true };
const VIP_LIST: PriceListRecord = { id: "pl-vip", code: "VIP", name: "VIP", isActive: true };

class FakePriceListRepository implements Partial<IPriceListRepository> {
  private lists = [WHOLESALE_LIST, VIP_LIST];
  /** productId -> priceListId -> price */
  overrides: Record<string, Record<string, number>> = {
    "product-1": { "pl-wholesale": 4000 },
  };
  async findByIdOrThrow(id: string): Promise<PriceListRecord> {
    const found = this.lists.find((l) => l.id === id);
    if (!found) throw new Error("not found");
    return found;
  }
  async findProductPrice(priceListId: string, productId: string): Promise<number | null> {
    return this.overrides[productId]?.[priceListId] ?? null;
  }
}

const RETEFUENTE_CONCEPT: WithholdingConceptRecord = {
  id: "concept-refuente",
  code: "RF-COMPRAS",
  name: "Compras generales",
  type: "RETEFUENTE",
  ratePercent: 2.5,
  isActive: true,
  dianConceptCode: null,
};

class FakeWithholdingConceptRepository implements Partial<IWithholdingConceptRepository> {
  constructor(private readonly concepts: WithholdingConceptRecord[] = [RETEFUENTE_CONCEPT]) {}
  async findByIdOrThrow(id: string): Promise<WithholdingConceptRecord> {
    const concept = this.concepts.find((c) => c.id === id);
    if (!concept) throw new Error("not found");
    return concept;
  }
}

class FakeSaleRepository implements Partial<ISaleRepository> {
  created: CreateSaleData[] = [];
  async create(data: CreateSaleData): Promise<SaleRecord> {
    this.created.push(data);
    return {
      id: "sale-1",
      companyId: "company-1",
      branchId: data.branchId,
      number: 1,
      customerId: data.customerId ?? null,
      sellerUserId: data.sellerUserId,
      status: data.status,
      paymentStatus: data.paymentStatus,
      subtotal: data.subtotal,
      discountTotal: data.discountTotal,
      taxTotal: data.taxTotal,
      total: data.total,
      retentionTotal: data.retentionTotal,
      cufe: null,
      cude: null,
      invoiceXmlUrl: null,
      accountReceivableId: null,
      requestedReceivableDueDate: data.requestedReceivableDueDate ?? null,
      currency: data.currency,
      exchangeRate: data.exchangeRate,
      foreignTotal: data.currency === "COP" ? null : data.total / data.exchangeRate,
      priceListId: data.priceListId,
      createdAt: new Date("2026-08-05"),
      withholdings: data.withholdings.map((w, i) => ({ ...w, id: `sw-${i}` })) as unknown as SaleRecord["withholdings"],
      items: data.items.map((item, i) => ({
        id: `sale-item-${i}`,
        productId: item.productId,
        quantity: item.quantity,
        unitPrice: item.unitPrice,
        discountPercent: item.discountPercent,
        taxPercent: item.taxPercent,
        taxAmount: item.taxAmount,
        total: item.total,
        requiresDiscountAuthorization: item.requiresDiscountAuthorization,
        discountAuthorizationId: null,
      })),
      payments: data.payments.map((p) => ({ method: p.method, amount: p.amount })),
      // Costo fijo arbitrario por unidad (distinto del costo real de PRODUCT, 3000) para que un
      // test pueda distinguir "el numero que llego" de cualquier otro monto de la venta.
      costTotal: data.items.reduce((sum, item) => sum + item.quantity * 1000, 0),
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

function makeUseCase(concepts?: WithholdingConceptRecord[]) {
  const saleRepo = new FakeSaleRepository();
  const postSaleJournalEntry = { execute: vi.fn().mockResolvedValue(null) } as unknown as PostSaleJournalEntryUseCase & {
    execute: (input: SaleJournalEntryInput) => Promise<null>;
  };
  const generateElectronicInvoice = { execute: vi.fn().mockResolvedValue(undefined) } as unknown as GenerateElectronicInvoiceUseCase;
  const webhookDispatcher = { dispatch: vi.fn().mockResolvedValue(undefined) } as unknown as WebhookDispatcherService;
  const sendInvoiceWhatsApp = { execute: vi.fn().mockResolvedValue(undefined) } as unknown as SendInvoiceWhatsAppUseCase;
  const auditRepo = new FakeAuditLogRepository();

  const useCase = new CreateSaleUseCase(
    saleRepo as unknown as ISaleRepository,
    new FakeProductRepository() as unknown as IProductRepository,
    new FakeDiscountLimitRepository(),
    new FakeWithholdingConceptRepository(concepts) as unknown as IWithholdingConceptRepository,
    new FakeCustomerRepository() as unknown as ICustomerRepository,
    new FakePriceListRepository() as unknown as IPriceListRepository,
    postSaleJournalEntry,
    generateElectronicInvoice,
    webhookDispatcher,
    sendInvoiceWhatsApp,
    new AuditService(auditRepo)
  );

  return { useCase, saleRepo, postSaleJournalEntry };
}

const BASE_INPUT = {
  branchId: "branch-1",
  items: [{ productId: "product-1", quantity: 2, discountPercent: 0 }],
  currency: "COP",
  exchangeRate: 1,
};

describe("CreateSaleUseCase — retenciones", () => {
  it("creates a sale with no withholdings unaffected (payments must cover the gross total)", async () => {
    const { useCase, saleRepo } = makeUseCase();

    const sale = await withTenantContext(() =>
      useCase.execute({ ...BASE_INPUT, payments: [{ method: "CASH", amount: 11_900 }], withholdings: [] })
    );

    expect(sale.retentionTotal).toBe(0);
    expect(saleRepo.created[0].retentionTotal).toBe(0);
  });

  it("rejects payments that cover the gross total but not the net-of-retention total", async () => {
    const { useCase } = makeUseCase();

    // subtotal = 10000, tax 19% = 1900, total = 11900. Retencion 2.5% sobre 10000 = 250.
    // netTotal = 11650 -- pagar el bruto (11900) ya no aplica, pero pagar exactamente eso
    // tampoco debe fallar: el caso que SI debe fallar es pagar menos que el neto.
    await expect(
      withTenantContext(() =>
        useCase.execute({
          ...BASE_INPUT,
          payments: [{ method: "CASH", amount: 11_000 }],
          withholdings: [{ withholdingConceptId: RETEFUENTE_CONCEPT.id, base: 10_000 }],
        })
      )
    ).rejects.toThrow(/no cubren el neto a cobrar/);
  });

  it("accepts payments that exactly cover the net-of-retention total", async () => {
    const { useCase, saleRepo, postSaleJournalEntry } = makeUseCase();

    const sale = await withTenantContext(() =>
      useCase.execute({
        ...BASE_INPUT,
        payments: [{ method: "CASH", amount: 11_650 }],
        withholdings: [{ withholdingConceptId: RETEFUENTE_CONCEPT.id, base: 10_000 }],
      })
    );

    expect(sale.status).toBe("COMPLETED");
    expect(sale.retentionTotal).toBe(250);
    expect(saleRepo.created[0].withholdings).toEqual([
      { withholdingConceptId: RETEFUENTE_CONCEPT.id, type: "RETEFUENTE", base: 10_000, ratePercent: 2.5, amount: 250 },
    ]);
    expect(postSaleJournalEntry.execute).toHaveBeenCalledWith(
      expect.objectContaining({ retentionTotal: 250, withholdingsByType: { RETEFUENTE: 250, RETEICA: 0, RETEIVA: 0 } })
    );
  });

  it("rejects an inactive withholding concept", async () => {
    const { useCase } = makeUseCase([{ ...RETEFUENTE_CONCEPT, isActive: false }]);

    await expect(
      withTenantContext(() =>
        useCase.execute({
          ...BASE_INPUT,
          payments: [{ method: "CASH", amount: 11_900 }],
          withholdings: [{ withholdingConceptId: RETEFUENTE_CONCEPT.id, base: 10_000 }],
        })
      )
    ).rejects.toThrow(/inactivo/);
  });

  it("rejects a retention base greater than the sale's subtotal", async () => {
    const { useCase } = makeUseCase();

    await expect(
      withTenantContext(() =>
        useCase.execute({
          ...BASE_INPUT,
          payments: [{ method: "CASH", amount: 11_900 }],
          withholdings: [{ withholdingConceptId: RETEFUENTE_CONCEPT.id, base: 50_000 }],
        })
      )
    ).rejects.toThrow(/no puede superar el subtotal/);
  });
});

describe("CreateSaleUseCase — costo de venta", () => {
  it("pasa el costTotal que devuelve el repositorio como costOfGoodsSold al comprobante contable", async () => {
    const { useCase, postSaleJournalEntry } = makeUseCase();

    await withTenantContext(() =>
      useCase.execute({ ...BASE_INPUT, payments: [{ method: "CASH", amount: 11_900 }], withholdings: [] })
    );

    // BASE_INPUT vende 2 unidades -> FakeSaleRepository.create() calcula costTotal = 2 * 1000.
    expect(postSaleJournalEntry.execute).toHaveBeenCalledWith(expect.objectContaining({ costOfGoodsSold: 2000 }));
  });
});

describe("CreateSaleUseCase — venta a credito (item 31)", () => {
  it("passes a receivable through to saleRepo.create() when there is a CREDIT payment", async () => {
    const { useCase, saleRepo } = makeUseCase();

    await withTenantContext(() =>
      useCase.execute({
        ...BASE_INPUT,
        customerId: "customer-1",
        payments: [{ method: "CREDIT", amount: 11_900 }],
        withholdings: [],
      })
    );

    expect(saleRepo.created[0].receivable).toMatchObject({ customerId: "customer-1", amount: 11_900 });
  });

  it("rejects a CREDIT payment without a customerId", async () => {
    const { useCase } = makeUseCase();

    await expect(
      withTenantContext(() =>
        useCase.execute({ ...BASE_INPUT, payments: [{ method: "CREDIT", amount: 11_900 }], withholdings: [] })
      )
    ).rejects.toThrow(/requiere un cliente asociado/);
  });

  it("does not create a receivable for a fully-paid CASH sale", async () => {
    const { useCase, saleRepo } = makeUseCase();

    await withTenantContext(() =>
      useCase.execute({ ...BASE_INPUT, payments: [{ method: "CASH", amount: 11_900 }], withholdings: [] })
    );

    expect(saleRepo.created[0].receivable).toBeUndefined();
  });

  it("passes the requested dueDate through to saleRepo.create() even without a CREDIT payment (so it is not lost if the item ends up requiring discount authorization)", async () => {
    const { useCase, saleRepo } = makeUseCase();
    const dueDate = new Date("2026-10-15");

    await withTenantContext(() =>
      useCase.execute({
        ...BASE_INPUT,
        customerId: "customer-1",
        payments: [{ method: "CREDIT", amount: 11_900 }],
        withholdings: [],
        dueDate,
      })
    );

    // La venta se completa de una vez (no hay descuento) -- el receivable ya se crea con este
    // dueDate, requestedReceivableDueDate queda undefined porque no hace falta duplicarlo.
    expect(saleRepo.created[0].receivable).toMatchObject({ dueDate });
    expect(saleRepo.created[0].requestedReceivableDueDate).toBeUndefined();
  });

  it("saves the requested dueDate on the sale itself when the sale needs discount authorization, instead of losing it (regression: antes siempre caia en el default de 30 dias al autorizarse)", async () => {
    const { useCase, saleRepo } = makeUseCase();
    const dueDate = new Date("2026-10-15");

    const sale = await withTenantContext(() =>
      useCase.execute({
        ...BASE_INPUT,
        items: [{ productId: "product-1", quantity: 2, discountPercent: 5 }],
        customerId: "customer-1",
        payments: [{ method: "CREDIT", amount: 9_405 }],
        withholdings: [],
        dueDate,
      })
    );

    expect(sale.status).toBe("PENDING_AUTHORIZATION");
    // Sin receivable todavia -- se crea recien al autorizarse (ver authorize-discount.use-case.ts).
    expect(saleRepo.created[0].receivable).toBeUndefined();
    // Pero el dueDate pedido no se pierde: queda guardado para usarse en ese momento.
    expect(saleRepo.created[0].requestedReceivableDueDate).toEqual(dueDate);
  });
});

describe("CreateSaleUseCase — multi-moneda informativa (item 33 de docs/ALCANCE.md)", () => {
  it("defaults to COP/1 and computes the exact same COP math as before this feature existed", async () => {
    const { useCase, saleRepo } = makeUseCase();

    const sale = await withTenantContext(() =>
      useCase.execute({ ...BASE_INPUT, payments: [{ method: "CASH", amount: 11_900 }], withholdings: [] })
    );

    expect(sale.currency).toBe("COP");
    expect(sale.exchangeRate).toBe(1);
    expect(sale.foreignTotal).toBeNull();
    expect(saleRepo.created[0].currency).toBe("COP");
    expect(saleRepo.created[0].exchangeRate).toBe(1);
    expect(sale.subtotal).toBe(10_000);
    expect(sale.total).toBe(11_900);
  });

  it("passes a non-COP currency/exchangeRate through to the repo without altering the COP totals", async () => {
    const { useCase, saleRepo } = makeUseCase();

    const sale = await withTenantContext(() =>
      useCase.execute({
        ...BASE_INPUT,
        payments: [{ method: "CASH", amount: 11_900 }],
        withholdings: [],
        currency: "USD",
        exchangeRate: 4200,
      })
    );

    expect(saleRepo.created[0].currency).toBe("USD");
    expect(saleRepo.created[0].exchangeRate).toBe(4200);
    // Misma matematica COP que el test "COP por defecto" arriba -- el motor de precios es
    // completamente ajeno a currency/exchangeRate.
    expect(sale.subtotal).toBe(10_000);
    expect(sale.total).toBe(11_900);
  });
});

describe("CreateSaleUseCase — listas de precios (item 35 de docs/ALCANCE.md)", () => {
  it("regression: sin priceListId ni cliente con lista asignada, usa el precio base (identico a antes de este item)", async () => {
    const { useCase, saleRepo } = makeUseCase();

    const sale = await withTenantContext(() =>
      useCase.execute({ ...BASE_INPUT, payments: [{ method: "CASH", amount: 11_900 }], withholdings: [] })
    );

    expect(saleRepo.created[0].priceListId).toBeNull();
    expect(sale.items[0].unitPrice).toBe(5000);
    expect(sale.subtotal).toBe(10_000);
    expect(sale.total).toBe(11_900);
  });

  it("usa el override de la lista explicita cuando existe uno para el producto", async () => {
    const { useCase, saleRepo } = makeUseCase();

    const sale = await withTenantContext(() =>
      useCase.execute({
        ...BASE_INPUT,
        priceListId: "pl-wholesale",
        payments: [{ method: "CASH", amount: 9520 }],
        withholdings: [],
      })
    );

    expect(saleRepo.created[0].priceListId).toBe("pl-wholesale");
    expect(sale.items[0].unitPrice).toBe(4000);
    expect(sale.subtotal).toBe(8000);
    expect(sale.total).toBe(9520);
  });

  it("cae al precio base si la lista explicita no tiene override para ese producto", async () => {
    const { useCase, saleRepo } = makeUseCase();

    const sale = await withTenantContext(() =>
      useCase.execute({
        ...BASE_INPUT,
        priceListId: "pl-vip",
        payments: [{ method: "CASH", amount: 11_900 }],
        withholdings: [],
      })
    );

    expect(saleRepo.created[0].priceListId).toBe("pl-vip");
    expect(sale.items[0].unitPrice).toBe(5000);
    expect(sale.total).toBe(11_900);
  });

  it("resuelve automaticamente la lista asignada al cliente cuando no viene priceListId explicito", async () => {
    const { useCase, saleRepo } = makeUseCase();

    const sale = await withTenantContext(() =>
      useCase.execute({
        ...BASE_INPUT,
        customerId: "customer-2",
        payments: [{ method: "CASH", amount: 9520 }],
        withholdings: [],
      })
    );

    expect(saleRepo.created[0].priceListId).toBe("pl-wholesale");
    expect(sale.items[0].unitPrice).toBe(4000);
    expect(sale.total).toBe(9520);
  });

  it("priceListId explicito gana sobre la lista asignada al cliente", async () => {
    const { useCase, saleRepo } = makeUseCase();

    const sale = await withTenantContext(() =>
      useCase.execute({
        ...BASE_INPUT,
        customerId: "customer-2",
        priceListId: "pl-vip",
        payments: [{ method: "CASH", amount: 11_900 }],
        withholdings: [],
      })
    );

    expect(saleRepo.created[0].priceListId).toBe("pl-vip");
    expect(sale.items[0].unitPrice).toBe(5000);
    expect(sale.total).toBe(11_900);
  });
});
