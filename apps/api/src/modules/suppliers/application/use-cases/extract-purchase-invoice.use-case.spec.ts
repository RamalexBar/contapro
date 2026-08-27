import { describe, expect, it } from "vitest";
import type { CreateSupplierData, ISupplierRepository, SupplierRecord } from "../../domain/supplier.repository";
import type { ExtractedPurchaseInvoice, IInvoiceExtractionService, InvoiceFileInput } from "../../domain/invoice-extraction.port";
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
    warnings: [],
    ...overrides,
  };
}

describe("ExtractPurchaseInvoiceUseCase", () => {
  it("matches an existing supplier by NIT, ignoring punctuation", async () => {
    const useCase = new ExtractPurchaseInvoiceUseCase(
      new FakeExtractionService(makeExtracted({ supplierNit: "900.123.456" })),
      new FakeSupplierRepo([makeSupplier({ nit: "900123456" })])
    );

    const result = await useCase.execute({ base64: "x", mediaType: "image/png" });

    expect(result.matchedSupplier).toEqual(expect.objectContaining({ id: "supplier-1" }));
  });

  it("falls back to name match when there is exactly one candidate", async () => {
    const useCase = new ExtractPurchaseInvoiceUseCase(
      new FakeExtractionService(makeExtracted({ supplierNit: null, supplierName: "Acme SAS" })),
      new FakeSupplierRepo([makeSupplier({ nit: "999999999" })])
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
      ])
    );

    const result = await useCase.execute({ base64: "x", mediaType: "image/png" });

    expect(result.matchedSupplier).toBeNull();
  });

  it("returns null when nothing matches", async () => {
    const useCase = new ExtractPurchaseInvoiceUseCase(
      new FakeExtractionService(makeExtracted({ supplierNit: "000", supplierName: "Desconocido" })),
      new FakeSupplierRepo([makeSupplier()])
    );

    const result = await useCase.execute({ base64: "x", mediaType: "image/png" });

    expect(result.matchedSupplier).toBeNull();
  });

  it("suggests a due date 30 days after the issue date", async () => {
    const useCase = new ExtractPurchaseInvoiceUseCase(
      new FakeExtractionService(makeExtracted({ issueDate: "2026-08-01" })),
      new FakeSupplierRepo([])
    );

    const result = await useCase.execute({ base64: "x", mediaType: "image/png" });

    expect(result.suggestedDueDate).toBe("2026-08-31");
  });

  it("does not suggest a due date when the issue date could not be read", async () => {
    const useCase = new ExtractPurchaseInvoiceUseCase(
      new FakeExtractionService(makeExtracted({ issueDate: null })),
      new FakeSupplierRepo([])
    );

    const result = await useCase.execute({ base64: "x", mediaType: "image/png" });

    expect(result.suggestedDueDate).toBeNull();
  });

  it("passes through extraction warnings unchanged", async () => {
    const useCase = new ExtractPurchaseInvoiceUseCase(
      new FakeExtractionService(makeExtracted({ warnings: ["El subtotal no cuadra con el total"] })),
      new FakeSupplierRepo([])
    );

    const result = await useCase.execute({ base64: "x", mediaType: "image/png" });

    expect(result.extracted.warnings).toEqual(["El subtotal no cuadra con el total"]);
  });
});
