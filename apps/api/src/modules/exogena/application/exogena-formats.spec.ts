import { describe, expect, it } from "vitest";
import type { ExogenaPayrollData, ExogenaYearData } from "../domain/exogena-data.reader";
import { buildFormat1001, buildFormat1005, buildFormat1006, buildFormat1007, buildFormat2276, paymentConcept } from "./exogena-formats";

const SUPPLIER = { id: "s1", documentType: "NIT", documentNumber: "900123456", name: "Distribuidora XYZ", municipalityCode: "11001" };
const LAWYER = { id: "s2", documentType: "CC", documentNumber: "10881234", name: "Abogada Perez", municipalityCode: null };
const CUSTOMER = { id: "c1", documentType: "NIT", documentNumber: "800111222", name: "Hotel Sol", municipalityCode: "66001" };

function data(overrides: Partial<ExogenaYearData> = {}): ExogenaYearData {
  return { purchases: [], sales: [], manualInvoices: [], shiftCloses: [], returns: [], creditNotes: [], suppliers: [SUPPLIER, LAWYER], customers: [CUSTOMER], ...overrides };
}

describe("1001 — pagos o abonos en cuenta", () => {
  it("uses the DIAN concept of what was bought, not 5002 (Honorarios) for everything", () => {
    expect(paymentConcept({ supplierId: "s", subtotal: 1, taxTotal: 0, kind: "INVENTORY", withholdings: [] })).toBe("5007");
    expect(paymentConcept({ supplierId: "s", subtotal: 1, taxTotal: 0, kind: "FIXED_ASSET", withholdings: [] })).toBe("5008");
    expect(paymentConcept({ supplierId: "s", subtotal: 1, taxTotal: 0, kind: "EXPENSE", withholdings: [] })).toBe("5016");
    expect(paymentConcept({ supplierId: "s", subtotal: 1, taxTotal: 0, kind: "EXPENSE", withholdings: [{ type: "RETEFUENTE", conceptCode: "RF-HONORARIOS", amount: 1 }] })).toBe("5002");
    expect(paymentConcept({ supplierId: "s", subtotal: 1, taxTotal: 0, kind: "EXPENSE", withholdings: [{ type: "RETEFUENTE", conceptCode: "RF-SERVICIOS", amount: 1 }] })).toBe("5004");
  });

  it("reports the payment without IVA and splits income-tax and IVA withholdings, one row per supplier and concept", () => {
    const rows = buildFormat1001(
      data({
        purchases: [
          { supplierId: "s1", subtotal: 1_000_000, taxTotal: 190_000, kind: "INVENTORY", withholdings: [{ type: "RETEFUENTE", conceptCode: "RF-COMPRAS", amount: 25_000 }, { type: "RETEIVA", conceptCode: "IVA-RETE", amount: 28_500 }, { type: "RETEICA", conceptCode: "ICA-GENERAL", amount: 9_660 }] },
          { supplierId: "s1", subtotal: 500_000, taxTotal: 95_000, kind: "INVENTORY", withholdings: [] },
          { supplierId: "s2", subtotal: 2_000_000, taxTotal: 0, kind: "EXPENSE", withholdings: [{ type: "RETEFUENTE", conceptCode: "RF-HONORARIOS", amount: 220_000 }] },
        ],
      })
    );
    expect(rows).toHaveLength(2);
    expect(rows[0]).toEqual(expect.objectContaining({ conceptoPago: "5007", documentNumber: "900123456", pagoDeducible: 1_500_000, retencionRentaPracticada: 25_000, retencionIvaResponsables: 28_500 }));
    expect(rows[1]).toEqual(expect.objectContaining({ conceptoPago: "5002", documentNumber: "10881234", pagoDeducible: 2_000_000, retencionRentaPracticada: 220_000, incompleto: true }));
  });
});

describe("1005 / 1006 — IVA", () => {
  const year = data({
    purchases: [{ supplierId: "s1", subtotal: 1_000_000, taxTotal: 190_000, kind: "INVENTORY", withholdings: [] }],
    sales: [
      { customerId: "c1", subtotal: 200_000, discountTotal: 0, taxTotal: 38_000 },
      { customerId: null, subtotal: 100_000, discountTotal: 10_000, taxTotal: 17_100 },
    ],
    manualInvoices: [{ customerId: "c1", subtotal: 300_000, ivaTotal: 0, incTotal: 24_000, external: false }],
    shiftCloses: [{ base: 400_000, iva: 76_000, inc: 0, returnsBase: 10_000, returnsIva: 1_900 }],
    returns: [
      { customerId: "c1", base: 50_000, tax: 9_500 },
      { customerId: null, base: 20_000, tax: 3_800 },
    ],
  });

  it("1005: IVA descontable per supplier and IVA of returns per customer; consumer-final returns as CONSUMIDOR FINAL", () => {
    const rows = buildFormat1005(year);
    expect(rows.find((r) => r.documentNumber === "900123456")).toEqual(expect.objectContaining({ ivaDescontable: 190_000, ivaDevolucionesVentas: 0 }));
    expect(rows.find((r) => r.documentNumber === "800111222")).toEqual(expect.objectContaining({ ivaDescontable: 0, ivaDevolucionesVentas: 9_500 }));
    expect(rows.find((r) => r.documentNumber === "222222222")).toEqual(
      expect.objectContaining({ documentType: "43", name: "CONSUMIDOR FINAL", ivaDevolucionesVentas: 5_700 })
    );
  });

  it("1006: IVA and consumption tax per customer; unidentified sales and external POS closes as CUANTIAS MENORES", () => {
    const rows = buildFormat1006(year);
    expect(rows.find((r) => r.documentNumber === "800111222")).toEqual(expect.objectContaining({ ivaGenerado: 38_000, impuestoConsumo: 24_000 }));
    expect(rows.find((r) => r.documentNumber === "222222222")).toEqual(expect.objectContaining({ documentType: "43", name: "CUANTIAS MENORES", ivaGenerado: 93_100 }));
  });

  it("1007: gross income with returns, discounts and credit notes apart, unidentified buyers included", () => {
    const rows = buildFormat1007({ ...year, creditNotes: [{ customerId: "c1", base: 8_000, tax: 1_520 }] });
    expect(rows.find((r) => r.documentNumber === "800111222")).toEqual(
      expect.objectContaining({ conceptoIngreso: "4001", valorIngreso: 500_000, devolucionesRebajasDescuentos: 58_000 })
    );
    expect(rows.find((r) => r.documentNumber === "222222222")).toEqual(
      expect.objectContaining({ valorIngreso: 500_000, devolucionesRebajasDescuentos: 40_000 })
    );
  });
});

describe("facturas de un POS externo (combo Cajapro)", () => {
  it("do not double count the shift close: the customer is identified and leaves the unidentified total", () => {
    const year = data({
      shiftCloses: [{ base: 400_000, iva: 76_000, inc: 0, returnsBase: 0, returnsIva: 0 }],
      manualInvoices: [
        { customerId: "c1", subtotal: 100_000, ivaTotal: 19_000, incTotal: 0, external: true },
        { customerId: null, subtotal: 50_000, ivaTotal: 9_500, incTotal: 0, external: true },
      ],
    });
    const income = buildFormat1007(year);
    expect(income.find((r) => r.documentNumber === "800111222")?.valorIngreso).toBe(100_000);
    expect(income.find((r) => r.documentNumber === "222222222")?.valorIngreso).toBe(300_000);
    const vat = buildFormat1006(year);
    expect(vat.find((r) => r.documentNumber === "800111222")?.ivaGenerado).toBe(19_000);
    expect(vat.find((r) => r.documentNumber === "222222222")?.ivaGenerado).toBe(57_000);
  });
});

describe("2276 — rentas de trabajo", () => {
  it("adds payroll and benefit settlements per employee into the labor-income columns", () => {
    const payroll: ExogenaPayrollData = {
      employees: [{ id: "e1", documentType: "CC", documentNumber: "1023456789", firstName: "Laura", middleName: null, lastName: "Gomez", secondLastName: "Rios", address: "Calle 1" }],
      workplaceMunicipalityCode: "17001",
      items: [
        { employeeId: "e1", conceptCode: "SALARY", amount: 18_000_000 },
        { employeeId: "e1", conceptCode: "TRANSPORT_ALLOWANCE", amount: 2_000_000 },
        { employeeId: "e1", conceptCode: "VACATION_PAY", amount: 700_000 },
        { employeeId: "e1", conceptCode: "SICK_LEAVE_EPS", amount: 300_000 },
        { employeeId: "e1", conceptCode: "HEALTH_EMPLOYEE", amount: 800_000 },
        { employeeId: "e1", conceptCode: "PENSION_EMPLOYEE", amount: 800_000 },
        { employeeId: "e1", conceptCode: "HEALTH_EMPLOYER", amount: 1_700_000 },
        { employeeId: "e1", conceptCode: "SEVERANCE", amount: 1_666_000 },
      ],
      settlements: [
        { employeeId: "e1", type: "SERVICE_BONUS", lines: [{ concept: "SERVICE_BONUS", amount: 900_000 }], withholding: 0, toSeveranceFund: 0 },
        {
          employeeId: "e1",
          type: "SEVERANCE",
          lines: [
            { concept: "SEVERANCE", amount: 1_700_000 },
            { concept: "SEVERANCE_INTEREST", amount: 204_000 },
          ],
          withholding: 0,
          toSeveranceFund: 1_700_000,
        },
      ],
    };
    const [row] = buildFormat2276(payroll);
    expect(row).toEqual(
      expect.objectContaining({
        documentNumber: "1023456789",
        firstSurname: "Gomez",
        secondSurname: "Rios",
        firstName: "Laura",
        municipalityCode: "17001",
        pagosSalarios: 20_000_000,
        pagosPrestacionesSociales: 1_600_000,
        otrosPagos: 300_000,
        cesantiasInteresesPagados: 204_000,
        cesantiasConsignadasFondo: 1_700_000,
        aportesSalud: 800_000,
        aportesPensionFsp: 800_000,
        retencionFuente: 0,
      })
    );
  });
});
