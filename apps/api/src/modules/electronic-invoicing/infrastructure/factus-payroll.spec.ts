import { describe, expect, it, vi } from "vitest";

vi.mock("../../../config/env", () => ({ env: { FACTUS_BASE_URL: "" } }));

import type { ThirdPartyPayrollInput } from "../domain/third-party-invoicing-client";
import { parseProviderRequest, serializeProviderRequest } from "../application/submit-third-party-document";
import { buildPayrollPayload, isPayrollRange, parseDocumentResponse } from "./factus-invoicing-client";

const d = (iso: string) => new Date(`${iso}T00:00:00.000Z`);

function input(overrides: Partial<ThirdPartyPayrollInput> = {}): ThirdPartyPayrollInput {
  return {
    referenceCode: "NE5-abc",
    year: 2026,
    month: 12,
    periodicity: "BIWEEKLY",
    paymentDates: [d("2026-12-15"), d("2026-12-31")],
    payment: { method: "TRANSFER", bankName: "Bancolombia", accountNumber: "123456789" },
    worker: {
      documentType: "CC",
      documentNumber: "1023456789",
      firstName: "Laura",
      otherNames: null,
      firstSurname: "Gomez",
      secondSurname: "Rios",
      address: "Calle 1",
      municipalityCode: "66001",
      integralSalary: false,
      workerTypeCode: "01",
      workerSubtypeCode: "00",
      contractTypeCode: "2",
      employeeCode: "1023456789",
      salary: 1_750_905,
      entryDate: d("2024-02-01"),
      retirementDate: null,
      daysWorked: 20,
    },
    items: [
      { conceptCode: "SALARY", quantity: 20, rate: 58_363.5, amount: 1_167_270 },
      { conceptCode: "TRANSPORT_ALLOWANCE", quantity: 20, rate: 8_303.17, amount: 166_063.33 },
      // 2 horas extra diurnas: hora ordinaria 8.337,64 x 1,25
      { conceptCode: "OVERTIME_DAY", quantity: 2, rate: 8_337.64, amount: 20_844.1 },
      { conceptCode: "NIGHT_SURCHARGE", quantity: 4, rate: 8_337.64, amount: 11_672.7 },
      { conceptCode: "SUNDAY_SURCHARGE", quantity: 8, rate: 80, amount: 53_360.9 },
      { conceptCode: "VACATION_PAY", quantity: 3, rate: 58_363.5, amount: 175_090.5 },
      { conceptCode: "SICK_LEAVE_EMPLOYER", quantity: 2, rate: 58_363.5, amount: 116_727 },
      { conceptCode: "SICK_LEAVE_EPS", quantity: 5, rate: 58_363.5, amount: 291_817.5 },
      { conceptCode: "UNPAID_LEAVE", quantity: 1, rate: 0, amount: 0 },
      { conceptCode: "HEALTH_EMPLOYEE", quantity: null, rate: 4, amount: 70_036.2 },
      { conceptCode: "PENSION_EMPLOYEE", quantity: null, rate: 4, amount: 70_036.2 },
      { conceptCode: "LOAN_DEDUCTION", quantity: null, rate: null, amount: 100_000 },
      { conceptCode: "HEALTH_EMPLOYER", quantity: null, rate: 8.5, amount: 148_826.93 },
    ],
    netPay: 1_700_000,
    ...overrides,
  };
}

describe("buildPayrollPayload", () => {
  it("reports two fortnights as one monthly document with both payment dates and quincenal period", () => {
    const p = buildPayrollPayload(input(), "01kwz1btv0bhtfnge77pkeenj3") as Record<string, any>;
    expect(p.numbering_range_id).toBe("01kwz1btv0bhtfnge77pkeenj3");
    expect(p.settlement_period).toEqual({ month: "12", year: "2026", payroll_period_code: "4" });
    expect(p.payment).toEqual({ payment_method_code: "47", bank_name: "Bancolombia", account_type: "2", account_number: "123456789", payment_dates: ["2026-12-15", "2026-12-31"] });
  });

  it("maps the worker with DIAN codes", () => {
    const w = (buildPayrollPayload(input(), "r") as Record<string, any>).worker;
    expect(w).toEqual(
      expect.objectContaining({
        identification_document_code: "13",
        identification_number: "1023456789",
        first_surname: "Gomez",
        second_surname: "Rios",
        municipality_code: "66001",
        contract_type: "2",
        salary: "1750905.00",
        entry_date: "2024-02-01",
        days_worked: 20,
        has_integral_salary: false,
      })
    );
    expect(w).not.toHaveProperty("other_names");
    expect(w).not.toHaveProperty("retirement_date");
  });

  it("maps salary, transport, overtime with its percentage, vacations, incapacities and unpaid leave", () => {
    const a = (buildPayrollPayload(input(), "r") as Record<string, any>).accruals;
    expect(a.suel).toEqual({ amount: "1167270.00" });
    expect(a.tra).toEqual([{ amount: "166063.33", accrual_type_code: "1" }]);
    expect(a.hora).toEqual([
      { quantity: "2.00", percentage: "25.00", amount: "20844.10", accrual_type_code: "1" },
      { quantity: "4.00", percentage: "35.00", amount: "11672.70", accrual_type_code: "3" },
      { quantity: "8.00", percentage: "80.00", amount: "53360.90", accrual_type_code: "5" },
    ]);
    expect(a.vaca).toEqual([{ quantity: 3, amount: "175090.50", accrual_type_code: "1" }]);
    // Dias del empleador y de la EPS: una sola incapacidad comun de 7 dias.
    expect(a.inca).toEqual([{ quantity: 7, amount: "408544.50", accrual_type_code: "1" }]);
    expect(a.lice).toEqual([{ quantity: 1, accrual_type_code: "3" }]);
  });

  it("maps employee deductions and ignores employer contributions", () => {
    const ded = (buildPayrollPayload(input(), "r") as Record<string, any>).deductions;
    expect(ded.salu).toEqual({ percentage: "4.00", amount: "70036.20" });
    expect(ded.pens).toEqual({ percentage: "4.00", amount: "70036.20" });
    expect(ded.libr).toEqual([{ amount: "100000.00", description: "Libranza" }]);
    expect(ded).not.toHaveProperty("dedu");
    expect(ded).not.toHaveProperty("rete");
    expect(JSON.stringify(ded)).not.toContain("148826.93");
  });

  it("sends FSP and withholding when there are, cash payment without bank data and the retirement date", () => {
    const p = buildPayrollPayload(
      input({
        periodicity: "MONTHLY",
        paymentDates: [d("2026-12-31")],
        payment: { method: "CASH", bankName: null, accountNumber: null },
        worker: { ...input().worker, retirementDate: d("2026-12-20") },
        items: [
          { conceptCode: "SALARY", quantity: 30, rate: 300_000, amount: 9_000_000 },
          { conceptCode: "HEALTH_EMPLOYEE", quantity: null, rate: 4, amount: 360_000 },
          { conceptCode: "PENSION_EMPLOYEE", quantity: null, rate: 4, amount: 360_000 },
          { conceptCode: "SOLIDARITY_FUND", quantity: null, rate: 1, amount: 90_000 },
          { conceptCode: "WITHHOLDING_TAX", quantity: null, rate: null, amount: 412_000 },
        ],
      }),
      "r"
    ) as Record<string, any>;
    expect(p.settlement_period.payroll_period_code).toBe("5");
    expect(p.payment).toEqual({ payment_method_code: "10", payment_dates: ["2026-12-31"] });
    expect(p.worker.retirement_date).toBe("2026-12-20");
    expect(p.deductions.dedu).toEqual([{ percentage: "1.00", amount: "90000.00", deduction_type_code: "1" }]);
    expect(p.deductions.rete).toEqual({ amount: "412000.00" });
    expect(p.accruals).not.toHaveProperty("tra");
  });
});

describe("Factus payroll helpers", () => {
  it("picks payroll ranges, not payroll adjustment note ranges", () => {
    expect(isPayrollRange("Nómina")).toBe(true);
    expect(isPayrollRange("Nota de Ajuste Nómina")).toBe(false);
  });

  it("reads the CUNE and checks the net balance Factus computed", () => {
    const raw = JSON.stringify({ status: "Created", data: { number: "NEF7", cune: "abc123", is_validated: true, net_balance: "1700000.00" } });
    expect(parseDocumentResponse(201, raw, 1_700_000)).toEqual(expect.objectContaining({ status: "ACCEPTED", number: "NEF7", uniqueCode: "abc123" }));
    expect(() => parseDocumentResponse(201, raw, 1_500_000)).toThrow(/otro documento/);
  });

  it("restores nested dates when a saved request is resent", () => {
    const parsed = parseProviderRequest<ThirdPartyPayrollInput>(serializeProviderRequest(input()));
    expect(parsed.paymentDates[1]).toBeInstanceOf(Date);
    expect(parsed.worker.entryDate).toBeInstanceOf(Date);
    expect(buildPayrollPayload(parsed, "r")).toEqual(buildPayrollPayload(input(), "r"));
  });
});
