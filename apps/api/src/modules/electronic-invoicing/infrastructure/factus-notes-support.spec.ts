import { describe, expect, it, vi } from "vitest";

vi.mock("../../../config/env", () => ({ env: { FACTUS_BASE_URL: "" } }));

import type { ThirdPartyNoteInput, ThirdPartySupportDocumentInput } from "../domain/third-party-invoicing-client";
import { buildNotePayload, buildSupportDocumentPayload, nitCheckDigit, parseDocumentResponse } from "./factus-invoicing-client";

const CUSTOMER: ThirdPartyNoteInput["customer"] = {
  documentType: "CC",
  documentNumber: "1088123456",
  name: "Cliente Prueba",
  email: null,
  phone: null,
  address: "Calle 1",
  postalCode: null,
  countryId: null,
  cityId: "66001",
  identityDocumentId: null,
  typeOrganizationId: null,
  taxRegimeId: null,
  taxLevelId: null,
};

function note(overrides: Partial<ThirdPartyNoteInput> = {}): ThirdPartyNoteInput {
  return {
    kind: "CREDIT",
    referenceCode: "CPNC1-abc",
    billNumber: "SETP990042087",
    conceptCode: "1",
    issueDate: new Date("2026-11-24T15:00:00Z"),
    observation: "Devolucion parcial",
    customer: CUSTOMER,
    lines: [{ code: "ITEM-1", description: "Licuadora", quantity: 1, unitPrice: 10_000, discountPercent: 0, taxPercent: 19 }],
    total: 11_900,
    paymentMethodCode: "10",
    ...overrides,
  };
}

// Mismas formas que se aceptaron en el sandbox de Factus el 2026-11-24 (CRTE1933, ND618, SEDS984001650).
describe("buildNotePayload", () => {
  it("references the invoice by its Factus number, with concept, customization 20 and the customer", () => {
    const payload = buildNotePayload(note(), 1776) as Record<string, unknown>;
    expect(payload).toEqual(
      expect.objectContaining({
        reference_code: "CPNC1-abc",
        correction_concept_code: "1",
        customization_id: "20",
        bill_number: "SETP990042087",
        numbering_range_id: 1776,
        observation: "Devolucion parcial",
        payment_details: [{ payment_form: "1", payment_method_code: "10", reference_code: "CPNC1-abc-pago", amount: "11900.00" }],
      })
    );
    expect(payload.customer).toEqual(expect.objectContaining({ identification_document_code: "13", identification: "1088123456", municipality_code: "66001" }));
    expect(payload.items).toEqual([
      expect.objectContaining({ code_reference: "ITEM-1", name: "Licuadora", quantity: "1.00", price: "10000.00", taxes: [{ code: "01", rate: "19.00" }] }),
    ]);
    expect(payload).not.toHaveProperty("send_email");
  });

  it("uses customization 30 for debit notes, always sends the customer (Factus requires it) and send_email", () => {
    const payload = buildNotePayload(
      note({ kind: "DEBIT", conceptCode: "1", lines: [{ code: "NOTA-1", description: "Intereses", quantity: 1, unitPrice: 5_000, taxPercent: 0, taxType: "EXCLUDED" }], total: 5_000 }),
      391
    ) as Record<string, unknown>;
    expect(payload).toEqual(expect.objectContaining({ customization_id: "30", send_email: false, customer: expect.any(Object) }));
    expect((payload.items as { taxes: unknown }[])[0]!.taxes).toEqual([{ is_excluded: true }]);
  });

  it("keeps the line discount so the note matches the invoice line", () => {
    const payload = buildNotePayload(
      note({ lines: [{ code: "ITEM-1", description: "Licuadora", quantity: 1, unitPrice: 100_000, discountPercent: 10, taxPercent: 19 }] }),
      1
    ) as { items: { discount_rate: string }[] };
    expect(payload.items[0]!.discount_rate).toBe("10.00");
  });
});

function supportDoc(overrides: Partial<ThirdPartySupportDocumentInput> = {}): ThirdPartySupportDocumentInput {
  return {
    referenceCode: "CPDS1-abc",
    issueDate: new Date("2026-11-24T15:00:00Z"),
    observation: "Soporte del proveedor: CC-15",
    provider: { documentType: "CC", documentNumber: "10881234", name: "Proveedor Natural", address: "Cra 2", email: null, phone: null, municipalityCode: "66001" },
    lines: [{ code: "DS-1", description: "Servicio de aseo", quantity: 1, unitPrice: 300_000, taxPercent: 0 }],
    total: 300_000,
    withholdings: [{ type: "RETEFUENTE", ratePercent: 4 }],
    ...overrides,
  };
}

describe("buildSupportDocumentPayload", () => {
  it("sends a resident natural person as document 31 with a valid check digit, organization 2 and no company", () => {
    const payload = buildSupportDocumentPayload(supportDoc(), 2058) as { provider: Record<string, unknown> };
    expect(payload.provider).toEqual(
      expect.objectContaining({
        identification_document_code: "31",
        identification: "10881234",
        dv: nitCheckDigit("10881234"),
        legal_organization_code: "2",
        names: "Proveedor Natural",
      })
    );
    expect(payload.provider).not.toHaveProperty("company");
  });

  it("treats a 9-digit NIT starting with 9 as a company", () => {
    const payload = buildSupportDocumentPayload(supportDoc({ provider: { ...supportDoc().provider, documentType: "NIT", documentNumber: "900123456-8", name: "Aseo SAS" } }), 1) as {
      provider: Record<string, unknown>;
    };
    expect(payload.provider).toEqual(expect.objectContaining({ identification: "900123456", dv: "8", legal_organization_code: "1", company: "Aseo SAS" }));
  });

  it("puts withholdings on each line and taxes always under code 01 (excluded when there is no IVA)", () => {
    const payload = buildSupportDocumentPayload(supportDoc(), 1) as { items: Record<string, unknown>[] };
    expect(payload.items[0]).toEqual(
      expect.objectContaining({ withholding_taxes: [{ code: "06", rate: "4.00" }], taxes: [{ code: "01", rate: "0.00", is_excluded: true }] })
    );
  });

  it("sends the purchase on credit with its due date when it has an account payable", () => {
    const payload = buildSupportDocumentPayload(supportDoc({ creditAmount: 300_000, dueDate: new Date("2026-12-24T00:00:00Z") }), 1) as {
      payment_details: Record<string, string>[];
    };
    expect(payload.payment_details).toEqual([
      { payment_form: "2", payment_method_code: "1", amount: "300000.00", due_date: "2026-12-24", reference_code: "CPDS1-abc-pago1" },
    ]);
  });
});

describe("parseDocumentResponse", () => {
  const accepted = (total: string) =>
    JSON.stringify({
      status: "Created",
      message: "Documento registrado y validado con éxito",
      data: { number: "CRTE1933", cude: "e725d133f1fb", is_validated: true, totals: { total }, errors: ["Regla: CAK55, Notificación: Correo electrónico no informado"] },
    });

  it("returns the Factus number and CUDE of an accepted note (DIAN notifications are not a rejection)", () => {
    expect(parseDocumentResponse(201, accepted("11900.00"), 11_900)).toEqual(expect.objectContaining({ status: "ACCEPTED", number: "CRTE1933", uniqueCode: "e725d133f1fb" }));
  });

  it("reads the CUDS of a support document", () => {
    const raw = JSON.stringify({ status: "Created", data: { number: "SEDS984001650", cuds: "98cd9781b6b5", is_validated: true, totals: { total: "300000.00" } } });
    expect(parseDocumentResponse(201, raw, 300_000)).toEqual(expect.objectContaining({ status: "ACCEPTED", uniqueCode: "98cd9781b6b5" }));
  });

  it("refuses a different document returned for a reused reference code", () => {
    expect(() => parseDocumentResponse(201, accepted("50000.00"), 11_900)).toThrow(/otro documento/);
  });

  it("turns field errors into a readable rejection", () => {
    const raw = JSON.stringify({ message: "Error de validación", errors: { "provider.dv": ["El campo dígito de verificación no es valido"] } });
    expect(parseDocumentResponse(422, raw, 1)).toEqual(
      expect.objectContaining({ status: "REJECTED", rejectionReason: "Error de validación: El campo dígito de verificación no es valido" })
    );
  });

  it("throws on authentication or server errors instead of disguising them as a rejection", () => {
    expect(() => parseDocumentResponse(500, "oops", 1)).toThrow(/500/);
  });
});
