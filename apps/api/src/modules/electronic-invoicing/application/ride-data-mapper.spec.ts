import { describe, expect, it } from "vitest";
import { buildUblInvoiceXml } from "./ubl-invoice-xml-builder";
import { buildUblNoteXml } from "./ubl-note-xml-builder";
import { buildUblSupportDocumentXml } from "./ubl-support-document-xml-builder";
import { buildDianPayrollXml } from "./dian-payroll-xml-builder";
import { mapInvoiceToRideData, mapNoteToRideData, mapPayrollToRideData, mapSupportDocumentToRideData } from "./ride-data-mapper";
import type { ElectronicInvoiceWithXml } from "../domain/electronic-invoice.repository";
import type { ElectronicCreditNoteWithXml } from "../domain/electronic-credit-note.repository";
import type { ElectronicSupportDocumentWithXml } from "../domain/electronic-support-document.repository";
import type { ElectronicPayrollWithXml } from "../domain/electronic-payroll.repository";

const issueDate = new Date("2026-07-29T15:30:00.000Z");

describe("mapInvoiceToRideData", () => {
  const xmlContent = buildUblInvoiceXml({
    fullNumber: "SETP990000001",
    cufe: "a".repeat(96),
    issueDate,
    environment: "HABILITACION",
    issuer: { nit: "900123456-7", legalName: "Minimarket La Esquina S.A.S." },
    buyer: { documentType: "CC", documentNumber: "1023456789", name: "Laura Gomez" },
    subtotal: 100000,
    taxTotal: 19000,
    total: 119000,
    items: [{ description: "Arroz 500g", quantity: 2, unitPrice: 5000, taxPercent: 19, taxAmount: 1900, total: 10000 }],
  });
  const doc: ElectronicInvoiceWithXml = {
    id: "inv-1",
    saleId: "sale-1",
    branchId: "branch-1",
    prefix: "SETP",
    number: 1,
    fullNumber: "SETP990000001",
    cufe: "a".repeat(96),
    issueDate,
    status: "PENDING_SUBMISSION",
    createdAt: issueDate,
    xmlContent,
    signedXmlContent: "<signed/>",
    dianTrackingId: null,
    rejectionReason: null,
  };

  it("extracts issuer, buyer, totals, and lines from the stored XML", () => {
    const ride = mapInvoiceToRideData(doc);
    expect(ride.documentTypeLabel).toBe("FACTURA ELECTRONICA DE VENTA");
    expect(ride.uniqueCode).toBe("a".repeat(96));
    expect(ride.issuer).toEqual({ nit: "900123456-7", legalName: "Minimarket La Esquina S.A.S." });
    expect(ride.counterparty).toEqual({ documentType: "CC", documentNumber: "1023456789", name: "Laura Gomez" });
    expect(ride.subtotal).toBe("100000.00");
    expect(ride.taxTotal).toBe("19000.00");
    expect(ride.total).toBe("119000.00");
    expect(ride.environment).toBe("HABILITACION");
    expect(ride.signed).toBe(true);
    expect(ride.lines).toHaveLength(1);
    expect(ride.lines[0]).toMatchObject({ description: "Arroz 500g", total: "10000.00" });
  });

  it("marks signed as false when signedXmlContent is null", () => {
    const ride = mapInvoiceToRideData({ ...doc, signedXmlContent: null });
    expect(ride.signed).toBe(false);
  });
});

describe("mapNoteToRideData", () => {
  const xmlContent = buildUblNoteXml("CREDIT", {
    fullNumber: "NC1",
    cude: "b".repeat(96),
    referenceCufe: "a".repeat(96),
    issueDate,
    environment: "HABILITACION",
    issuer: { nit: "900123456-7", legalName: "Minimarket La Esquina S.A.S." },
    buyer: { documentType: "CC", documentNumber: "1023456789", name: "Laura Gomez" },
    amount: 26180,
    taxAmount: 4180,
    reason: "Devolucion de mercancia",
  });
  const doc: ElectronicCreditNoteWithXml = {
    id: "cn-1",
    creditNoteId: "note-1",
    branchId: "branch-1",
    prefix: "NC",
    number: 1,
    fullNumber: "NC1",
    cude: "b".repeat(96),
    issueDate,
    status: "GENERATED",
    createdAt: issueDate,
    xmlContent,
    signedXmlContent: null,
    dianTrackingId: null,
    rejectionReason: null,
  };

  it("synthesizes a single line from the note's reason", () => {
    const ride = mapNoteToRideData(doc, "CREDIT");
    expect(ride.documentTypeLabel).toBe("NOTA CREDITO ELECTRONICA");
    expect(ride.uniqueCode).toBe("b".repeat(96));
    expect(ride.total).toBe("26180.00");
    expect(ride.lines).toEqual([{ description: "Devolucion de mercancia", total: "26180.00" }]);
  });
});

describe("mapSupportDocumentToRideData", () => {
  const xmlContent = buildUblSupportDocumentXml({
    fullNumber: "DS1",
    cuds: "c".repeat(96),
    issueDate,
    environment: "PRODUCCION",
    issuer: { nit: "900123456-7", legalName: "Minimarket La Esquina S.A.S." },
    supplier: { documentType: "CC", documentNumber: "80123456", name: "Vendedor Informal" },
    subtotal: 50000,
    taxTotal: 0,
    total: 50000,
  });
  const doc: ElectronicSupportDocumentWithXml = {
    id: "sd-1",
    purchaseId: "purchase-1",
    branchId: "branch-1",
    prefix: "DS",
    number: 1,
    fullNumber: "DS1",
    cuds: "c".repeat(96),
    issueDate,
    status: "GENERATED",
    createdAt: issueDate,
    xmlContent,
    signedXmlContent: null,
    dianTrackingId: null,
    rejectionReason: null,
  };

  it("inverts issuer/counterparty roles (company is issuer, supplier is the counterparty)", () => {
    const ride = mapSupportDocumentToRideData(doc);
    expect(ride.issuer).toEqual({ nit: "900123456-7", legalName: "Minimarket La Esquina S.A.S." });
    expect(ride.counterpartyLabel).toBe("Proveedor");
    expect(ride.counterparty).toEqual({ documentType: "CC", documentNumber: "80123456", name: "Vendedor Informal" });
    expect(ride.environment).toBe("PRODUCCION");
  });

  it("has no itemized lines (the XML builder does not emit InvoiceLine yet)", () => {
    const ride = mapSupportDocumentToRideData(doc);
    expect(ride.lines).toEqual([]);
  });
});

describe("mapPayrollToRideData", () => {
  const xmlContent = buildDianPayrollXml({
    fullNumber: "1",
    cune: "d".repeat(96),
    issueDate,
    periodStart: new Date("2026-10-01"),
    periodEnd: new Date("2026-10-31"),
    environment: "HABILITACION",
    employer: { nit: "900123456-7", legalName: "Minimarket La Esquina S.A.S.", municipalityCode: null },
    employee: {
      documentType: "CC",
      documentNumber: "1023456789",
      firstName: "Laura",
      middleName: null,
      lastName: "Gomez",
      secondLastName: null,
      workerType: "01",
      workerSubtype: "00",
      contractTypeCode: "1",
      position: "Auxiliar de bodega",
      hireDate: new Date("2024-02-01"),
      salary: 1400000,
    },
    earnings: [
      { conceptCode: "SALARY", amount: 1400000 },
      { conceptCode: "TRANSPORT_ALLOWANCE", amount: 200000 },
    ],
    deductions: [
      { conceptCode: "HEALTH_EMPLOYEE", amount: 56000 },
      { conceptCode: "PENSION_EMPLOYEE", amount: 56000 },
    ],
    grossTotal: 1600000,
    totalDeductions: 112000,
    netPay: 1488000,
  });
  const doc: ElectronicPayrollWithXml = {
    id: "pr-1",
    payrollDetailId: "detail-1",
    branchId: "branch-1",
    prefix: null,
    number: 1,
    fullNumber: "1",
    cune: "d".repeat(96),
    issueDate,
    status: "PENDING_SUBMISSION",
    createdAt: issueDate,
    xmlContent,
    signedXmlContent: "<signed/>",
    dianTrackingId: null,
    rejectionReason: null,
  };

  it("extracts employer/employee, earnings, and deductions (including RetencionFuente fixed at 0)", () => {
    const ride = mapPayrollToRideData(doc);
    expect(ride.documentTypeLabel).toBe("NOMINA ELECTRONICA (COMPROBANTE INDIVIDUAL)");
    expect(ride.issuer).toEqual({ nit: "900123456-7", legalName: "Minimarket La Esquina S.A.S." });
    expect(ride.counterparty).toEqual({ documentType: "CC", documentNumber: "1023456789", name: "Laura Gomez" });
    expect(ride.total).toBe("1488000.00");
    const descriptions = ride.lines.map((l) => l.description);
    expect(descriptions).toEqual(
      expect.arrayContaining(["Sueldo trabajado", "Auxilio de transporte", "Salud", "Fondo de pension", "Retencion en la fuente"])
    );
  });
});
