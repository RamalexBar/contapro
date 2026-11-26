import { describe, expect, it } from "vitest";
import type { ExogenaPayrollData } from "../domain/exogena-data.reader";
import { buildIncomeCertificates, buildWithholdingCertificates } from "./certificates";

const SUPPLIER = { id: "s1", documentType: "NIT", documentNumber: "900123456", name: "Distribuidora XYZ", municipalityCode: "11001" };
const OTHER = { id: "s2", documentType: "CC", documentNumber: "10881234", name: "Abogada Perez", municipalityCode: null };

describe("buildWithholdingCertificates", () => {
  it("adds base and withheld amount per type and concept, and only certifies suppliers with withholdings", () => {
    const certs = buildWithholdingCertificates(
      {
        suppliers: [SUPPLIER, OTHER],
        purchases: [
          { supplierId: "s1", subtotal: 1_000_000, taxTotal: 190_000, kind: "INVENTORY", withholdings: [
            { type: "RETEFUENTE", conceptCode: "RF-COMPRAS", conceptName: "Compras", base: 1_000_000, ratePercent: 2.5, amount: 25_000 },
            { type: "RETEIVA", conceptCode: "IVA-RETE", conceptName: "ReteIVA 15%", base: 190_000, ratePercent: 15, amount: 28_500 },
          ] },
          { supplierId: "s1", subtotal: 2_000_000, taxTotal: 0, kind: "INVENTORY", withholdings: [
            { type: "RETEFUENTE", conceptCode: "RF-COMPRAS", conceptName: "Compras", base: 2_000_000, ratePercent: 2.5, amount: 50_000 },
          ] },
          { supplierId: "s2", subtotal: 50_000, taxTotal: 0, kind: "EXPENSE", withholdings: [] },
        ],
      },
      2026
    );
    expect(certs).toHaveLength(1);
    expect(certs[0]!.lines).toEqual([
      { type: "RETEFUENTE", conceptCode: "RF-COMPRAS", conceptName: "Compras", base: 3_000_000, ratePercent: 2.5, amount: 75_000 },
      { type: "RETEIVA", conceptCode: "IVA-RETE", conceptName: "ReteIVA 15%", base: 190_000, ratePercent: 15, amount: 28_500 },
    ]);
    expect(certs[0]!.totals).toEqual({ RETEFUENTE: 75_000, RETEIVA: 28_500, RETEICA: 0, total: 103_500 });
  });

  it("shows no single rate when the same concept was withheld at different rates (declarant / non-declarant)", () => {
    const [cert] = buildWithholdingCertificates(
      {
        suppliers: [OTHER],
        purchases: [
          { supplierId: "s2", subtotal: 1, taxTotal: 0, kind: "EXPENSE", withholdings: [{ type: "RETEFUENTE", conceptCode: "RF-SERVICIOS", base: 100_000, ratePercent: 4, amount: 4_000 }] },
          { supplierId: "s2", subtotal: 1, taxTotal: 0, kind: "EXPENSE", withholdings: [{ type: "RETEFUENTE", conceptCode: "RF-SERVICIOS", base: 100_000, ratePercent: 6, amount: 6_000 }] },
        ],
      },
      2026
    );
    expect(cert!.lines[0]).toEqual(expect.objectContaining({ ratePercent: null, base: 200_000, amount: 10_000 }));
  });
});

describe("buildIncomeCertificates (formulario 220)", () => {
  const payroll = (hireDate: Date, terminationDate: Date | null): ExogenaPayrollData => ({
    employees: [{ id: "e1", documentType: "CC", documentNumber: "123", firstName: "Ana", middleName: null, lastName: "Gomez", secondLastName: null, address: null, hireDate, terminationDate }],
    workplaceMunicipalityCode: "66001",
    items: [
      { employeeId: "e1", conceptCode: "SALARY", amount: 10_000_000 },
      { employeeId: "e1", conceptCode: "HEALTH_EMPLOYEE", amount: 400_000 },
      { employeeId: "e1", conceptCode: "PENSION_EMPLOYEE", amount: 400_000 },
      { employeeId: "e1", conceptCode: "WITHHOLDING_TAX", amount: 120_000 },
    ],
    settlements: [{ employeeId: "e1", type: "SEVERANCE", lines: [{ concept: "SEVERANCE", amount: 900_000 }, { concept: "SEVERANCE_INTEREST", amount: 108_000 }], withholding: 0, toSeveranceFund: 900_000 }],
  });

  it("uses the same figures as the 2276 and adds the gross income total", () => {
    const [cert] = buildIncomeCertificates(payroll(new Date("2020-03-01"), null), 2026);
    expect(cert).toEqual(expect.objectContaining({
      pagosSalarios: 10_000_000,
      cesantiasConsignadasFondo: 900_000,
      cesantiasInteresesPagados: 108_000,
      totalIngresosBrutos: 11_008_000,
      aportesSalud: 400_000,
      aportesPensionFsp: 400_000,
      retencionFuente: 120_000,
    }));
    expect(cert!.periodFrom.toISOString().slice(0, 10)).toBe("2026-01-01");
    expect(cert!.periodTo.toISOString().slice(0, 10)).toBe("2026-12-31");
  });

  it("cuts the certified period to the hire and termination dates within the year", () => {
    const [cert] = buildIncomeCertificates(payroll(new Date("2026-04-15"), new Date("2026-10-31")), 2026);
    expect(cert!.periodFrom.toISOString().slice(0, 10)).toBe("2026-04-15");
    expect(cert!.periodTo.toISOString().slice(0, 10)).toBe("2026-10-31");
  });
});
