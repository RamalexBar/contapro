import { describe, expect, it } from "vitest";
import type { IPurchaseRepository, PurchaseRecord } from "../../suppliers/domain/purchase.repository";
import type { ISupplierRepository, SupplierRecord } from "../../suppliers/domain/supplier.repository";
import type { AccountPayableRecord, IAccountPayableRepository } from "../../suppliers/domain/account-payable.repository";
import type { ISaleRepository, SaleRecord } from "../../pos/sale/domain/sale.repository";
import type { CustomerRecord, ICustomerRepository } from "../../customers/domain/customer.repository";
import type { AccountReceivableRecord, IAccountReceivableRepository } from "../../collections/domain/account-receivable.repository";
import type { IWithholdingConceptRepository, WithholdingConceptRecord } from "../../accounting/domain/withholding-concept.repository";
import { ExogenaReportService } from "./exogena-report.service";

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
  municipalityCode: "11001",
};
const SUPPLIER_INCOMPLETE: SupplierRecord = { ...SUPPLIER, id: "supplier-2", nit: "900999999", name: "Proveedor Incompleto", municipalityCode: null };

class FakeSupplierRepository implements Partial<ISupplierRepository> {
  private suppliers = [SUPPLIER, SUPPLIER_INCOMPLETE];
  async findByIdOrThrow(id: string): Promise<SupplierRecord> {
    const found = this.suppliers.find((s) => s.id === id);
    if (!found) throw new Error("not found");
    return found;
  }
}

const CUSTOMER: CustomerRecord = {
  id: "customer-1",
  documentType: "CC",
  documentNumber: "123",
  name: "Cliente Uno",
  email: null,
  phone: null,
  creditLimit: 0,
  currentBalance: 0,
  isActive: true,
  priceListId: null,
  municipalityCode: "05001",
};

class FakeCustomerRepository implements Partial<ICustomerRepository> {
  async findByIdOrThrow(id: string): Promise<CustomerRecord> {
    if (id !== CUSTOMER.id) throw new Error("not found");
    return CUSTOMER;
  }
}

const CONCEPT_WITH_CODE: WithholdingConceptRecord = {
  id: "concept-1",
  code: "RF",
  name: "Compras generales",
  type: "RETEFUENTE",
  ratePercent: 2.5,
  isActive: true,
  dianConceptCode: "1301",
};
const CONCEPT_NO_CODE: WithholdingConceptRecord = {
  id: "concept-2",
  code: "ICA",
  name: "ICA",
  type: "RETEICA",
  ratePercent: 1,
  isActive: true,
  dianConceptCode: null,
};

class FakeWithholdingConceptRepository implements Partial<IWithholdingConceptRepository> {
  async list(): Promise<WithholdingConceptRecord[]> {
    return [CONCEPT_WITH_CODE, CONCEPT_NO_CODE];
  }
}

function makePurchase(overrides: Partial<PurchaseRecord>): PurchaseRecord {
  return {
    id: "purchase-1",
    branchId: "branch-1",
    supplierId: SUPPLIER.id,
    invoiceNumber: "F-1",
    subtotal: 100_000,
    taxTotal: 0,
    total: 100_000,
    retentionTotal: 2500,
    withholdings: [{ withholdingConceptId: CONCEPT_WITH_CODE.id, type: "RETEFUENTE", base: 100_000, ratePercent: 2.5, amount: 2500 }],
    status: "REGISTERED",
    createdAt: new Date(2026, 5, 1),
    accountPayableId: "ap-1",
    dueDate: new Date(2026, 6, 1),
    journalEntryId: null,
    currency: "COP",
    exchangeRate: 1,
    foreignTotal: null,
    ...overrides,
  };
}

class FakePurchaseRepository implements Partial<IPurchaseRepository> {
  constructor(private readonly purchases: PurchaseRecord[]) {}
  async listForYear(year: number): Promise<PurchaseRecord[]> {
    return this.purchases.filter((p) => p.createdAt.getFullYear() === year);
  }
}

function makeSale(overrides: Partial<SaleRecord>): SaleRecord {
  return {
    id: "sale-1",
    companyId: "company-1",
    branchId: "branch-1",
    number: 1,
    customerId: CUSTOMER.id,
    sellerUserId: "user-1",
    status: "COMPLETED",
    paymentStatus: "PAID",
    subtotal: 80_000,
    discountTotal: 0,
    taxTotal: 15_200,
    total: 95_200,
    retentionTotal: 0,
    cufe: null,
    cude: null,
    invoiceXmlUrl: null,
    createdAt: new Date(2026, 5, 1),
    accountReceivableId: null,
    requestedReceivableDueDate: null,
    currency: "COP",
    exchangeRate: 1,
    foreignTotal: null,
    priceListId: null,
    withholdings: [],
    items: [],
    payments: [],
    costTotal: 0,
    ...overrides,
  };
}

class FakeSaleRepository implements Partial<ISaleRepository> {
  constructor(private readonly sales: SaleRecord[]) {}
  async listForYear(year: number): Promise<SaleRecord[]> {
    return this.sales.filter((s) => s.createdAt.getFullYear() === year);
  }
}

class FakeAccountPayableRepository implements Partial<IAccountPayableRepository> {
  constructor(private readonly payables: AccountPayableRecord[]) {}
  async listActive(): Promise<AccountPayableRecord[]> {
    return this.payables;
  }
}

class FakeAccountReceivableRepository implements Partial<IAccountReceivableRepository> {
  constructor(private readonly receivables: AccountReceivableRecord[]) {}
  async listActive(): Promise<AccountReceivableRecord[]> {
    return this.receivables;
  }
}

function makeService(opts: { purchases?: PurchaseRecord[]; sales?: SaleRecord[]; payables?: AccountPayableRecord[]; receivables?: AccountReceivableRecord[] }) {
  return new ExogenaReportService(
    new FakePurchaseRepository(opts.purchases ?? []) as unknown as IPurchaseRepository,
    new FakeSaleRepository(opts.sales ?? []) as unknown as ISaleRepository,
    new FakeSupplierRepository() as unknown as ISupplierRepository,
    new FakeCustomerRepository() as unknown as ICustomerRepository,
    new FakeAccountPayableRepository(opts.payables ?? []) as unknown as IAccountPayableRepository,
    new FakeAccountReceivableRepository(opts.receivables ?? []) as unknown as IAccountReceivableRepository,
    new FakeWithholdingConceptRepository() as unknown as IWithholdingConceptRepository
  );
}

describe("ExogenaReportService", () => {
  it("getFormat1001: agrega pago y retencion practicada por proveedor, dentro del año, marca incompleto sin municipio", async () => {
    const purchases = [
      makePurchase({ supplierId: SUPPLIER.id, total: 100_000, retentionTotal: 2500, createdAt: new Date(2026, 5, 1) }),
      makePurchase({
        id: "purchase-2",
        supplierId: SUPPLIER_INCOMPLETE.id,
        total: 50_000,
        retentionTotal: 500,
        withholdings: [{ withholdingConceptId: CONCEPT_NO_CODE.id, type: "RETEICA", base: 50_000, ratePercent: 1, amount: 500 }],
        createdAt: new Date(2026, 5, 1),
      }),
      makePurchase({ id: "purchase-old", supplierId: SUPPLIER.id, total: 20_000, retentionTotal: 0, createdAt: new Date(2025, 5, 1) }),
    ];
    const service = makeService({ purchases });

    const rows2026 = await service.getFormat1001(2026);
    expect(rows2026).toHaveLength(2);
    const supplier1Row = rows2026.find((r) => r.supplierId === SUPPLIER.id)!;
    expect(supplier1Row.valorPago).toBe(100_000);
    expect(supplier1Row.valorRetencionPracticada).toBe(2500);
    expect(supplier1Row.conceptoPago).toBe("5002");
    expect(supplier1Row.incompleto).toBe(false);
    const supplier2Row = rows2026.find((r) => r.supplierId === SUPPLIER_INCOMPLETE.id)!;
    expect(supplier2Row.incompleto).toBe(true);

    const rows2025 = await service.getFormat1001(2025);
    expect(rows2025).toEqual([expect.objectContaining({ supplierId: SUPPLIER.id, valorPago: 20_000 })]);
  });

  it("getFormat1003: agrega base/retencion por proveedor y concepto, marca conceptoIncompleto sin dianConceptCode", async () => {
    const purchases = [
      makePurchase({ supplierId: SUPPLIER.id, createdAt: new Date(2026, 5, 1) }),
      makePurchase({
        id: "purchase-2",
        supplierId: SUPPLIER_INCOMPLETE.id,
        withholdings: [{ withholdingConceptId: CONCEPT_NO_CODE.id, type: "RETEICA", base: 50_000, ratePercent: 1, amount: 500 }],
        createdAt: new Date(2026, 5, 1),
      }),
    ];
    const service = makeService({ purchases });

    const rows = await service.getFormat1003(2026);
    expect(rows).toHaveLength(2);
    const withCode = rows.find((r) => r.supplierId === SUPPLIER.id)!;
    expect(withCode.conceptoRetencion).toBe("1301");
    expect(withCode.conceptoIncompleto).toBe(false);
    expect(withCode.valorBase).toBe(100_000);
    expect(withCode.valorRetencion).toBe(2500);
    const noCode = rows.find((r) => r.supplierId === SUPPLIER_INCOMPLETE.id)!;
    expect(noCode.conceptoRetencion).toBeNull();
    expect(noCode.conceptoIncompleto).toBe(true);
  });

  it("getFormat1007: agrega ingresos por cliente y excluye ventas sin cliente (consumidor final)", async () => {
    const sales = [
      makeSale({ customerId: CUSTOMER.id, subtotal: 80_000, createdAt: new Date(2026, 5, 1) }),
      makeSale({ id: "sale-2", customerId: null, subtotal: 30_000, createdAt: new Date(2026, 5, 2) }),
      makeSale({ id: "sale-old", customerId: CUSTOMER.id, subtotal: 10_000, createdAt: new Date(2025, 5, 1) }),
    ];
    const service = makeService({ sales });

    const rows2026 = await service.getFormat1007(2026);
    expect(rows2026).toEqual([expect.objectContaining({ customerId: CUSTOMER.id, valorIngreso: 80_000 })]);

    const rows2025 = await service.getFormat1007(2025);
    expect(rows2025).toEqual([expect.objectContaining({ customerId: CUSTOMER.id, valorIngreso: 10_000 })]);
  });

  it("getFormat1008: agrega saldo actual de cuentas por cobrar activas, sumando varias del mismo cliente", async () => {
    const receivables: AccountReceivableRecord[] = [
      { id: "ar-1", customerId: CUSTOMER.id, saleId: "sale-1", branchId: "branch-1", amount: 30_000, balance: 30_000, dueDate: new Date(), status: "PENDING" },
      { id: "ar-2", customerId: CUSTOMER.id, saleId: "sale-2", branchId: "branch-1", amount: 5_000, balance: 5_000, dueDate: new Date(), status: "PARTIAL" },
    ];
    const service = makeService({ receivables });

    const rows = await service.getFormat1008();
    expect(rows).toEqual([expect.objectContaining({ customerId: CUSTOMER.id, saldo: 35_000 })]);
  });

  it("getFormat1009: agrega saldo actual de cuentas por pagar activas por proveedor", async () => {
    const payables: AccountPayableRecord[] = [
      { id: "ap-1", supplierId: SUPPLIER.id, purchaseId: "purchase-1", branchId: "branch-1", amount: 10_000, balance: 10_000, dueDate: new Date(), status: "PENDING" },
    ];
    const service = makeService({ payables });

    const rows = await service.getFormat1009();
    expect(rows).toEqual([expect.objectContaining({ supplierId: SUPPLIER.id, saldo: 10_000 })]);
  });
});
