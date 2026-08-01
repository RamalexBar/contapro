import { describe, expect, it } from "vitest";
import type { EmployeeRecord } from "../../employees/domain/employee.repository";
import type { PayrollDeductionRecord } from "../domain/payroll-deduction.repository";
import type { PayrollParameterRecord } from "../domain/payroll-parameter.repository";
import { calculateEmployeePayroll } from "./payroll-calculator";

// Valores de PayrollParameter tal como los siembra packages/database/prisma/seed.ts (2026, de
// EJEMPLO, no cifras oficiales -- ver ese archivo).
function makeParameter(overrides: Partial<PayrollParameterRecord> = {}): PayrollParameterRecord {
  return {
    id: "param-2026",
    year: 2026,
    effectiveFrom: new Date("2026-01-01"),
    effectiveTo: null,
    minimumWage: 1400000,
    transportAllowance: 200000,
    uvt: 49000,
    healthEmployeePercent: 4,
    healthEmployerPercent: 8.5,
    pensionEmployeePercent: 4,
    pensionEmployerPercent: 12,
    arlPercentByRiskLevel: { I: 0.522, II: 1.044, III: 2.436, IV: 4.35, V: 6.96 },
    severancePercent: 8.33,
    severanceInterestPercent: 12,
    serviceBonusPercent: 8.33,
    vacationPercent: 4.17,
    familyCompensationPercent: 4,
    icbfPercent: 3,
    senaPercent: 2,
    overtimeDayPercent: 25,
    overtimeNightPercent: 75,
    nightSurchargePercent: 35,
    sundayHolidaySurchargePercent: 75,
    monthlyHoursDivisor: 220,
    isActive: true,
    ...overrides,
  };
}

function makeEmployee(overrides: Partial<EmployeeRecord> = {}): EmployeeRecord {
  return {
    id: "emp-1",
    companyId: "company-1",
    branchId: "branch-1",
    userId: null,
    documentType: "CC",
    documentNumber: "1023456789",
    firstName: "Laura",
    lastName: "Gomez",
    middleName: null,
    secondLastName: null,
    workerType: "01",
    workerSubtype: "00",
    birthDate: null,
    address: null,
    phone: null,
    email: null,
    position: "Auxiliar de bodega",
    contractType: "INDEFINITE",
    baseSalary: 1400000,
    hireDate: new Date("2024-02-01"),
    terminationDate: null,
    status: "ACTIVE",
    eps: null,
    arlRiskLevel: "I",
    pensionFund: null,
    compensationFund: null,
    bankName: null,
    bankAccountNumber: null,
    ...overrides,
  };
}

function makeDeduction(overrides: Partial<PayrollDeductionRecord> = {}): PayrollDeductionRecord {
  return {
    id: "ded-1",
    employeeId: "emp-1",
    type: "LOAN_DEDUCTION",
    description: "Credito libranza banco X",
    amountPerPeriod: 100000,
    totalAmount: 500000,
    remainingBalance: 500000,
    status: "ACTIVE",
    startDate: new Date("2026-01-01"),
    createdAt: new Date("2026-01-01"),
    ...overrides,
  };
}

const PERIOD_START = new Date("2026-07-01");
const PERIOD_END = new Date("2026-07-31");

describe("calculateEmployeePayroll -- libranzas y embargos (PayrollDeduction)", () => {
  it("does not touch netPay when there are no active deductions", () => {
    const result = calculateEmployeePayroll(makeEmployee(), makeParameter(), [], PERIOD_START, PERIOD_END, []);

    // Salario 1,400,000 + auxilio 200,000 = 1,600,000 bruto; salud+pension empleado 4%+4% sobre
    // la base salarial (1,400,000, sin auxilio) = 112,000; neto = 1,488,000.
    expect(result.grossTotal).toBe(1_600_000);
    expect(result.totalDeductions).toBe(112_000);
    expect(result.netPay).toBe(1_488_000);
    expect(result.items.some((i) => i.conceptCode === "LOAN_DEDUCTION" || i.conceptCode === "GARNISHMENT")).toBe(false);
  });

  it("applies an active loan deduction and reduces netPay by the scheduled amount", () => {
    const deduction = makeDeduction();
    const result = calculateEmployeePayroll(makeEmployee(), makeParameter(), [], PERIOD_START, PERIOD_END, [deduction]);

    expect(result.netPay).toBe(1_488_000 - 100_000);
    expect(result.totalDeductions).toBe(112_000 + 100_000);
    const item = result.items.find((i) => i.conceptCode === "LOAN_DEDUCTION");
    expect(item).toMatchObject({ amount: 100_000, payrollDeductionId: "ded-1" });
  });

  it("applies only what's left of the balance for a loan's final installment", () => {
    const deduction = makeDeduction({ amountPerPeriod: 100_000, totalAmount: 500_000, remainingBalance: 30_000 });
    const result = calculateEmployeePayroll(makeEmployee(), makeParameter(), [], PERIOD_START, PERIOD_END, [deduction]);

    const item = result.items.find((i) => i.conceptCode === "LOAN_DEDUCTION");
    expect(item?.amount).toBe(30_000); // no los 100,000 programados -- ya no quedaba mas saldo
    expect(result.netPay).toBe(1_488_000 - 30_000);
  });

  it("applies an indefinite garnishment (no totalAmount/remainingBalance) at its full period amount", () => {
    const garnishment = makeDeduction({
      id: "ded-2",
      type: "GARNISHMENT",
      description: "Embargo judicial",
      amountPerPeriod: 150_000,
      totalAmount: undefined,
      remainingBalance: null,
    });
    const result = calculateEmployeePayroll(makeEmployee(), makeParameter(), [], PERIOD_START, PERIOD_END, [garnishment]);

    const item = result.items.find((i) => i.conceptCode === "GARNISHMENT");
    expect(item?.amount).toBe(150_000);
    expect(result.netPay).toBe(1_488_000 - 150_000);
  });

  it("caps combined additional deductions so netPay never goes negative (not a legal embargo limit, a data-integrity safeguard)", () => {
    // netPay antes de deducciones adicionales es 1,488,000. Dos deducciones que suman mas que
    // eso: la primera se aplica completa, la segunda queda topada al remanente.
    const first = makeDeduction({ id: "ded-1", amountPerPeriod: 1_000_000, totalAmount: 1_000_000, remainingBalance: 1_000_000 });
    const second = makeDeduction({ id: "ded-2", type: "GARNISHMENT", amountPerPeriod: 900_000, totalAmount: undefined, remainingBalance: null });
    const result = calculateEmployeePayroll(makeEmployee(), makeParameter(), [], PERIOD_START, PERIOD_END, [first, second]);

    expect(result.netPay).toBe(0);
    const firstItem = result.items.find((i) => i.payrollDeductionId === "ded-1");
    const secondItem = result.items.find((i) => i.payrollDeductionId === "ded-2");
    expect(firstItem?.amount).toBe(1_000_000);
    expect(secondItem?.amount).toBe(488_000); // 1,488,000 - 1,000,000 restante, no los 900,000 programados
  });

  it("includes the applied deductions in the payslip summary JSON for the PDF", () => {
    const deduction = makeDeduction();
    const result = calculateEmployeePayroll(makeEmployee(), makeParameter(), [], PERIOD_START, PERIOD_END, [deduction]);

    const summary = result.summary as { deducciones: { adicionales: Array<{ id: string; amount: number }> } };
    expect(summary.deducciones.adicionales).toEqual([
      { id: "ded-1", type: "LOAN_DEDUCTION", description: "Credito libranza banco X", amount: 100_000 },
    ]);
  });
});
