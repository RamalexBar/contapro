import { describe, expect, it } from "vitest";
import type { ExpenseCategoryRecord, IExpenseCategoryRepository } from "../../domain/expense-category.repository";
import type { ExpenseCategoryOption, ExtractedExpenseReceipt, IReceiptExtractionService } from "../../domain/receipt-extraction.port";
import { ExtractExpenseReceiptUseCase } from "./extract-expense-receipt.use-case";

const CATEGORIES: ExpenseCategoryRecord[] = [
  { id: "cat-arriendo", code: "ARR", name: "Arriendo", accountCode: "5120", isActive: true },
  { id: "cat-servicios", code: "SERV", name: "Servicios públicos", accountCode: "5135", isActive: true },
  { id: "cat-vieja", code: "OLD", name: "Categoria inactiva", accountCode: "5195", isActive: false },
];

const categoryRepo = { list: async () => CATEGORIES } as unknown as IExpenseCategoryRepository;

function receipt(overrides: Partial<ExtractedExpenseReceipt>): ExtractedExpenseReceipt {
  return {
    payeeName: "Empresa de Energia de Pereira", payeeNit: "816002019", documentNumber: "123", issueDate: "2026-10-01",
    description: "Energia septiembre", subtotal: 100000, taxTotal: 19000, total: 119000, categoryCode: "SERV", warnings: [],
    ...overrides,
  };
}

function reader(result: ExtractedExpenseReceipt, seen: ExpenseCategoryOption[][] = []): IReceiptExtractionService {
  return { extract: async (_file, categories) => (seen.push(categories), result) };
}

const FILE = { base64: "x", mediaType: "image/jpeg" as const };

describe("ExtractExpenseReceiptUseCase", () => {
  it("offers only active categories and returns the suggested one with the IVA %", async () => {
    const seen: ExpenseCategoryOption[][] = [];
    const result = await new ExtractExpenseReceiptUseCase(reader(receipt({}), seen), categoryRepo).execute(FILE);

    expect(seen[0]).toEqual([{ code: "ARR", name: "Arriendo" }, { code: "SERV", name: "Servicios públicos" }]);
    expect(result.suggestedCategory).toEqual({ id: "cat-servicios", name: "Servicios públicos" });
    expect(result.taxRatePercent).toBe(19);
  });

  it("ignores a category code that is not an active category of the company", async () => {
    const inactive = await new ExtractExpenseReceiptUseCase(reader(receipt({ categoryCode: "OLD" })), categoryRepo).execute(FILE);
    const invented = await new ExtractExpenseReceiptUseCase(reader(receipt({ categoryCode: "NOPE" })), categoryRepo).execute(FILE);
    expect(inactive.suggestedCategory).toBeNull();
    expect(invented.suggestedCategory).toBeNull();
  });

  it("returns 0% for a receipt without IVA and null when the subtotal is unknown", async () => {
    const noIva = await new ExtractExpenseReceiptUseCase(reader(receipt({ subtotal: 15000, taxTotal: 0, total: 15000 })), categoryRepo).execute(FILE);
    const unknown = await new ExtractExpenseReceiptUseCase(reader(receipt({ subtotal: null })), categoryRepo).execute(FILE);
    expect(noIva.taxRatePercent).toBe(0);
    expect(unknown.taxRatePercent).toBeNull();
  });
});
