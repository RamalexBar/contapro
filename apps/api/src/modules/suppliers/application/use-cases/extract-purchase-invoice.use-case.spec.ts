import { describe, expect, it } from "vitest";
import type { CreateSupplierData, ISupplierRepository, SupplierRecord } from "../../domain/supplier.repository";
import type {
  ExtractedInvoiceLine,
  ExtractedPurchaseInvoice,
  IInvoiceExtractionService,
  InvoiceFileInput,
} from "../../domain/invoice-extraction.port";
import type { IProductRepository, ProductListItem } from "../../../inventory/product/domain/product.repository";
import type { Product } from "../../../inventory/product/domain/product.entity";
import { ExtractPurchaseInvoiceUseCase } from "./extract-purchase-invoice.use-case";

class FakeExtractionService implements IInvoiceExtractionService {
  constructor(private readonly result: ExtractedPurchaseInvoice) {}
  extract(_file: InvoiceFileInput): Promise<ExtractedPurchaseInvoice> {
    return Promise.resolve(this.result);
  }
}

class FakeSupplierRepo implements ISupplierRepository {
  constructor(private readonly suppliers: SupplierRecord[]) {}
  create(_data: CreateSupplierData): Promise<SupplierRecord> {
    throw new Error("not used in this spec");
  }
  list(search?: string): Promise<SupplierRecord[]> {
    if (!search) return Promise.resolve(this.suppliers);
    const needle = search.toLowerCase();
    return Promise.resolve(this.suppliers.filter((s) => s.name.toLowerCase().includes(needle)));
  }
  findByIdOrThrow(): Promise<SupplierRecord> {
    throw new Error("not used in this spec");
  }
  findByNit(): Promise<SupplierRecord | null> {
    throw new Error("not used in this spec");
  }
}

interface FakeProduct {
  id: string;
  name: string;
  sku: string;
  barcodes: string[];
}

class FakeProductRepo {
  constructor(private readonly products: FakeProduct[]) {}
  async findByBarcode(code: string): Promise<Product | null> {
    const found = this.products.find((p) => p.barcodes.includes(code));
    return found ? ({ toProps: { id: found.id, name: found.name, sku: found.sku } } as unknown as Product) : null;
  }
  async list(search?: string): Promise<ProductListItem[]> {
    const needle = (search ?? "").toLowerCase();
    return this.products
      .filter((p) => p.name.toLowerCase().includes(needle))
      .map((p) => ({ ...p, location: null, categoryId: null, brandId: null, currentPrice: 0, currentCost: 0, taxRate: 19, isActive: true }));
  }
}

function fakeProductRepo(products: FakeProduct[]): IProductRepository {
  return new FakeProductRepo(products) as unknown as IProductRepository;
}

function makeLine(overrides: Partial<ExtractedInvoiceLine> = {}): ExtractedInvoiceLine {
  return { description: "Gaseosa 400 ml", code: null, quantity: 24, unitPrice: 1_800, taxRate: 19, lineTotal: 43_200, ...overrides };
}

function makeSupplier(overrides: Partial<SupplierRecord> = {}): SupplierRecord {
  return {
    id: "supplier-1",
    name: "Acme SAS",
    nit: "900123456",
    contactName: null,
    phone: null,
    email: null,
    address: null,
    isActive: true,
    isObligatedToInvoice: true,
    documentType: "NIT",
    municipalityCode: null,
    ...overrides,
  };
}

function makeExtracted(overrides: Partial<ExtractedPurchaseInvoice> = {}): ExtractedPurchaseInvoice {
  return {
    supplierName: "Acme SAS",
    supplierNit: "900.123.456",
    invoiceNumber: "FE-100",
    issueDate: "2026-08-01",
    subtotal: 100_000,
    taxTotal: 19_000,
    total: 119_000,
    currency: "COP",
    items: [],
    warnings: [],
    ...overrides,
  };
}

describe("ExtractPurchaseInvoiceUseCase", () => {
  it("matches an existing supplier by NIT, ignoring punctuation", async () => {
    const useCase = new ExtractPurchaseInvoiceUseCase(
      new FakeExtractionService(makeExtracted({ supplierNit: "900.123.456" })),
      new FakeSupplierRepo([makeSupplier({ nit: "900123456" })]),
      fakeProductRepo([])
    );

    const result = await useCase.execute({ base64: "x", mediaType: "image/png" });

    expect(result.matchedSupplier).toEqual(expect.objectContaining({ id: "supplier-1" }));
  });

  it("falls back to name match when there is exactly one candidate", async () => {
    const useCase = new ExtractPurchaseInvoiceUseCase(
      new FakeExtractionService(makeExtracted({ supplierNit: null, supplierName: "Acme SAS" })),
      new FakeSupplierRepo([makeSupplier({ nit: "999999999" })]),
      fakeProductRepo([])
    );

    const result = await useCase.execute({ base64: "x", mediaType: "image/png" });

    expect(result.matchedSupplier).toEqual(expect.objectContaining({ id: "supplier-1" }));
  });

  it("does not guess when the name matches more than one supplier", async () => {
    const useCase = new ExtractPurchaseInvoiceUseCase(
      new FakeExtractionService(makeExtracted({ supplierNit: null, supplierName: "Acme" })),
      new FakeSupplierRepo([
        makeSupplier({ id: "s1", name: "Acme SAS", nit: "1" }),
        makeSupplier({ id: "s2", name: "Acme Distribuciones", nit: "2" }),
      ]),
      fakeProductRepo([])
    );

    const result = await useCase.execute({ base64: "x", mediaType: "image/png" });

    expect(result.matchedSupplier).toBeNull();
  });

  it("returns null when nothing matches", async () => {
    const useCase = new ExtractPurchaseInvoiceUseCase(
      new FakeExtractionService(makeExtracted({ supplierNit: "000", supplierName: "Desconocido" })),
      new FakeSupplierRepo([makeSupplier()]),
      fakeProductRepo([])
    );

    const result = await useCase.execute({ base64: "x", mediaType: "image/png" });

    expect(result.matchedSupplier).toBeNull();
  });

  it("suggests a due date 30 days after the issue date", async () => {
    const useCase = new ExtractPurchaseInvoiceUseCase(
      new FakeExtractionService(makeExtracted({ issueDate: "2026-08-01" })),
      new FakeSupplierRepo([]),
      fakeProductRepo([])
    );

    const result = await useCase.execute({ base64: "x", mediaType: "image/png" });

    expect(result.suggestedDueDate).toBe("2026-08-31");
  });

  it("does not suggest a due date when the issue date could not be read", async () => {
    const useCase = new ExtractPurchaseInvoiceUseCase(
      new FakeExtractionService(makeExtracted({ issueDate: null })),
      new FakeSupplierRepo([]),
      fakeProductRepo([])
    );

    const result = await useCase.execute({ base64: "x", mediaType: "image/png" });

    expect(result.suggestedDueDate).toBeNull();
  });

  it("passes through extraction warnings unchanged", async () => {
    const useCase = new ExtractPurchaseInvoiceUseCase(
      new FakeExtractionService(makeExtracted({ warnings: ["El subtotal no cuadra con el total"] })),
      new FakeSupplierRepo([]),
      fakeProductRepo([])
    );

    const result = await useCase.execute({ base64: "x", mediaType: "image/png" });

    expect(result.extracted.warnings).toEqual(["El subtotal no cuadra con el total"]);
  });
});

describe("ExtractPurchaseInvoiceUseCase — renglones de productos", () => {
  const PRODUCTS: FakeProduct[] = [
    { id: "p-gaseosa", name: "Gaseosa 400 ml", sku: "GAS-400", barcodes: ["7702004003508"] },
    { id: "p-arroz-1", name: "Arroz Diana 500 g", sku: "ARR-500", barcodes: [] },
    { id: "p-arroz-2", name: "Arroz Diana 1000 g", sku: "ARR-1000", barcodes: [] },
  ];

  async function linesFor(items: ExtractedInvoiceLine[]) {
    const useCase = new ExtractPurchaseInvoiceUseCase(
      new FakeExtractionService(makeExtracted({ items })),
      new FakeSupplierRepo([]),
      fakeProductRepo(PRODUCTS)
    );
    return (await useCase.execute({ base64: "x", mediaType: "image/png" })).lines;
  }

  it("matches a line by barcode even when the description differs", async () => {
    const [line] = await linesFor([makeLine({ description: "GASEOSA COLA PET", code: "7702004003508" })]);
    expect(line.matchedProduct).toEqual({ id: "p-gaseosa", name: "Gaseosa 400 ml", sku: "GAS-400" });
  });

  it("matches by exact name ignoring accents and case", async () => {
    const [line] = await linesFor([makeLine({ description: "ARROZ DIANA 500 G" })]);
    expect(line.matchedProduct?.id).toBe("p-arroz-1");
  });

  it("does not guess when several products contain the description", async () => {
    const [line] = await linesFor([makeLine({ description: "Arroz Diana" })]);
    expect(line.matchedProduct).toBeNull();
  });

  it("keeps the extracted values and returns one entry per line, in order", async () => {
    const lines = await linesFor([makeLine(), makeLine({ description: "Producto que no existe", quantity: 3 })]);
    expect(lines).toHaveLength(2);
    expect(lines[0].matchedProduct?.id).toBe("p-gaseosa");
    expect(lines[1]).toMatchObject({ description: "Producto que no existe", quantity: 3, matchedProduct: null });
  });
});
