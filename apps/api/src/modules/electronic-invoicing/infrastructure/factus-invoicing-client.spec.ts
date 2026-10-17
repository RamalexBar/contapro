import { describe, expect, it, vi } from "vitest";

vi.mock("../../../config/env", () => ({ env: { FACTUS_BASE_URL: "" } }));

import type { ThirdPartyInvoiceInput } from "../domain/third-party-invoicing-client";
import { buildBillPayload, buildPaymentDetails, nitCheckDigit, splitNit } from "./factus-invoicing-client";

function input(lines: ThirdPartyInvoiceInput["lines"]): ThirdPartyInvoiceInput {
  return {
    resolutionNumber: "18760000001",
    prefix: "SETP",
    documentNumber: 1,
    issueDate: new Date("2026-10-13"),
    subtotal: 0,
    taxTotal: 0,
    total: 0,
    customer: { documentType: "CC", documentNumber: "222222222222", name: "Consumidor final", email: null, phone: null, address: null } as ThirdPartyInvoiceInput["customer"],
    lines,
  };
}

// Codigo de tributo por renglon (2026-10-13): restaurantes facturan INC, no IVA.
describe("buildBillPayload -- impuesto por renglon", () => {
  it("IVA sale con el codigo 01 y INC con el 04; sin impuesto no manda tributo", () => {
    const payload = buildBillPayload(
      input([
        { description: "Gaseosa", code: "ITEM-1", quantity: 1, unitPrice: 3361.34, taxPercent: 19, taxType: "IVA", taxAmount: 638.66, lineTotal: 4000 },
        { description: "Bandeja paisa", code: "ITEM-2", quantity: 1, unitPrice: 25925.93, taxPercent: 8, taxType: "INC", taxAmount: 2074.07, lineTotal: 28000 },
        { description: "Arroz", code: "ITEM-3", quantity: 1, unitPrice: 5000, taxPercent: 0, taxType: "EXCLUDED", taxAmount: 0, lineTotal: 5000 },
      ]),
      1
    ) as { items: { taxes: { code: string; rate: string }[] }[] };

    expect(payload.items[0].taxes).toEqual([{ code: "01", rate: "19.00" }]);
    expect(payload.items[1].taxes).toEqual([{ code: "04", rate: "8.00" }]);
    expect(payload.items[2].taxes).toEqual([]);
  });

  it("sin taxType (ventas del POS propio de Contapro) sigue siendo IVA, como antes", () => {
    const payload = buildBillPayload(
      input([{ description: "Producto", code: "ITEM-1", quantity: 2, unitPrice: 1000, taxPercent: 19, taxAmount: 380, lineTotal: 2380 }]),
      1
    ) as { items: { taxes: { code: string }[] }[] };
    expect(payload.items[0].taxes[0].code).toBe("01");
  });
});

// Pagos, descuentos, retenciones y comprador con NIT (2026-10-17, probado contra el sandbox).
function sale(overrides: Partial<ThirdPartyInvoiceInput>): ThirdPartyInvoiceInput {
  return {
    ...input([{ description: "Silla", code: "P1", quantity: 2, unitPrice: 100000, taxPercent: 19, taxAmount: 38000, lineTotal: 238000 }]),
    total: 238000,
    ...overrides,
  };
}
const sumOf = (details: Record<string, string>[]) => details.reduce((s, d) => s + Number(d.amount), 0);

describe("buildPaymentDetails", () => {
  it("removes the cash change so payments add up to the invoice total", () => {
    const details = buildPaymentDetails(sale({ payments: [{ method: "CASH", amount: 250000 }] }), "R");
    expect(details).toEqual([expect.objectContaining({ payment_form: "1", payment_method_code: "10", amount: "238000.00" })]);
  });

  it("keeps mixed payments with their DIAN codes", () => {
    const details = buildPaymentDetails(
      sale({ payments: [{ method: "CASH", amount: 100000 }, { method: "CARD", amount: 100000 }, { method: "TRANSFER", amount: 38000 }] }),
      "R"
    );
    expect(details.map((d) => [d.payment_method_code, d.amount])).toEqual([["10", "100000.00"], ["48", "100000.00"], ["47", "38000.00"]]);
  });

  it("sends the credit part as form 2 with its due date", () => {
    const details = buildPaymentDetails(
      sale({ payments: [{ method: "CASH", amount: 38000 }, { method: "CREDIT", amount: 200000 }], dueDate: new Date("2026-11-16T12:00:00Z") }),
      "R"
    );
    expect(details[1]).toMatchObject({ payment_form: "2", payment_method_code: "1", amount: "200000.00", due_date: "2026-11-16" });
    expect(sumOf(details)).toBe(238000);
  });

  it("adds what was withheld to the last payment, because Factus wants the total before withholdings", () => {
    // Neto cobrado: 238.000 - 5.000 de retefuente.
    const details = buildPaymentDetails(sale({ payments: [{ method: "TRANSFER", amount: 233000 }] }), "R");
    expect(details).toEqual([expect.objectContaining({ payment_method_code: "47", amount: "238000.00" })]);
  });

  it("falls back to a single cash payment when the source has no payments", () => {
    expect(buildPaymentDetails(sale({}), "R")).toEqual([expect.objectContaining({ payment_form: "1", payment_method_code: "42", amount: "238000.00" })]);
  });
});

describe("comprador con NIT, descuento y retenciones", () => {
  it("computes the NIT check digit like the DIAN", () => {
    expect(nitCheckDigit("900123456")).toBe("8");
    expect(nitCheckDigit("800197268")).toBe("4"); // DIAN
    expect(nitCheckDigit("890903938")).toBe("8"); // Bancolombia
    expect(splitNit("900.123.456-8")).toEqual({ identification: "900123456", dv: "8" });
    expect(splitNit("900123456")).toEqual({ identification: "900123456", dv: "8" });
  });

  it("sends company, dv, IVA tribute and responsibilities for a NIT buyer", () => {
    const payload = buildBillPayload(
      sale({
        customer: {
          documentType: "nit", documentNumber: "900123456-8", name: "Muebles SAS", email: null, phone: null, address: null,
          taxRegimeId: "01", taxLevelId: "O-13, O-23",
        } as ThirdPartyInvoiceInput["customer"],
      }),
      1
    ) as { customer: Record<string, unknown> };
    expect(payload.customer).toMatchObject({
      identification_document_code: "31", identification: "900123456", dv: "8", company: "Muebles SAS",
      legal_organization_code: "1", tribute_code: "01", responsibilities: ["O-13", "O-23"],
    });
  });

  it("sends the line discount and applies ReteIVA only to lines with IVA", () => {
    const payload = buildBillPayload(
      sale({
        lines: [
          { description: "Silla", code: "P1", quantity: 2, unitPrice: 100000, taxPercent: 19, taxAmount: 34200, lineTotal: 214200, discountPercent: 10 },
          { description: "Arroz", code: "P2", quantity: 1, unitPrice: 5000, taxPercent: 0, taxAmount: 0, lineTotal: 5000 },
        ],
        withholdings: [{ type: "RETEFUENTE", ratePercent: 2.5 }, { type: "RETEIVA", ratePercent: 15 }],
      }),
      1
    ) as { items: { discount_rate: string; withholding_taxes?: { code: string; rate: string }[] }[] };
    expect(payload.items[0].discount_rate).toBe("10.00");
    expect(payload.items[0].withholding_taxes).toEqual([{ code: "06", rate: "2.50" }, { code: "05", rate: "15.00" }]);
    expect(payload.items[1].withholding_taxes).toEqual([{ code: "06", rate: "2.50" }]);
  });
});
