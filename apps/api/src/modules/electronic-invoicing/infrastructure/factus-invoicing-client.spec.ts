import { describe, expect, it, vi } from "vitest";

vi.mock("../../../config/env", () => ({ env: { FACTUS_BASE_URL: "" } }));

import type { ThirdPartyInvoiceInput } from "../domain/third-party-invoicing-client";
import { buildBillPayload } from "./factus-invoicing-client";

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
