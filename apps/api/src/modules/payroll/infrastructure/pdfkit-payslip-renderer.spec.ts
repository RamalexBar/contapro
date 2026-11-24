import { describe, expect, it } from "vitest";
import { renderPayslipPdf } from "./pdfkit-payslip-renderer";
import type { PayslipPdfData } from "../application/payslip-data-mapper";

describe("renderPayslipPdf", () => {
  it("produces a well-formed, non-trivial PDF buffer", async () => {
    const data: PayslipPdfData = {
      company: { name: "Minimarket La Esquina S.A.S.", nit: "900123456-7" },
      employee: {
        fullName: "Laura Gomez",
        documentType: "CC",
        documentNumber: "1023456789",
        position: "Auxiliar de bodega",
        contractType: "INDEFINITE",
      },
      periodStart: new Date("2026-07-01T00:00:00.000Z"),
      periodEnd: new Date("2026-07-31T00:00:00.000Z"),
      paymentDate: new Date("2026-07-31T00:00:00.000Z"),
      periodLabel: "Julio de 2026",
      daysWorked: 30,
      workedDays: 30,
      noveltiesLabel: "",
      earnings: [
        { label: "Salario", amount: 1400000 },
        { label: "Auxilio de transporte", amount: 200000 },
      ],
      grossTotal: 1600000,
      deductions: [
        { label: "Salud (empleado)", amount: 56000 },
        { label: "Pension (empleado)", amount: 56000 },
      ],
      totalDeductions: 112000,
      netPay: 1488000,
      generatedAt: new Date("2026-08-01T00:00:00.000Z"),
    };

    const pdfBuffer = await renderPayslipPdf(data);

    expect(pdfBuffer.subarray(0, 5).toString("ascii")).toBe("%PDF-");
    expect(pdfBuffer.length).toBeGreaterThan(500);
  });

  it("handles empty earnings/deductions without throwing", async () => {
    const data: PayslipPdfData = {
      company: { name: "", nit: "" },
      employee: { fullName: "", documentType: "CC", documentNumber: "", position: "", contractType: "" },
      periodStart: null,
      periodEnd: null,
      paymentDate: null,
      periodLabel: "",
      daysWorked: 0,
      workedDays: 0,
      noveltiesLabel: "",
      earnings: [],
      grossTotal: 0,
      deductions: [],
      totalDeductions: 0,
      netPay: 0,
      generatedAt: new Date("2026-08-01T00:00:00.000Z"),
    };

    const pdfBuffer = await renderPayslipPdf(data);
    expect(pdfBuffer.subarray(0, 5).toString("ascii")).toBe("%PDF-");
  });
});
