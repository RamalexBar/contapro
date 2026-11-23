import { describe, expect, it } from "vitest";
import type { EmployeeRecord } from "../../employees/domain/employee.repository";
import type { PayrollDeductionRecord } from "../domain/payroll-deduction.repository";
import type { PayrollParameterRecord } from "../domain/payroll-parameter.repository";
import { payslipPeriodLabel } from "./payslip-data-mapper";
import { calculateEmployeePayroll, daysWorkedInPeriod, legalMonthlyHoursDivisor, legalSundaySurchargePercent, salaryWithholdingTax, solidarityFundPercent } from "./payroll-calculator";

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
    salaryType: "ORDINARY",
    withholdingDependents: false,
    withholdingHousingInterest: 0,
    withholdingPrepaidHealth: 0,
    withholdingVoluntaryPension: 0,
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

describe("calculateEmployeePayroll -- base de cesantias y prima", () => {
  const amount = (result: ReturnType<typeof calculateEmployeePayroll>, code: string) =>
    result.items.find((i) => i.conceptCode === code)?.amount;

  it("includes the transport allowance in severance and service bonus, but not in vacation or contributions", () => {
    const result = calculateEmployeePayroll(makeEmployee(), makeParameter(), [], PERIOD_START, PERIOD_END, []);

    // Base de prestaciones = 1,400,000 + 200,000 de auxilio = 1,600,000 x 8.33% = 133,280.
    expect(amount(result, "SEVERANCE")).toBe(133_280);
    expect(amount(result, "SERVICE_BONUS")).toBe(133_280);
    // Intereses: provision del 12% de las cesantias causadas en el mes (al cierre del año suman el 12%).
    expect(amount(result, "SEVERANCE_INTEREST")).toBe(15_993.6);
    // Vacaciones y aportes siguen solo sobre el salario (1,400,000).
    expect(amount(result, "VACATION")).toBe(58_380);
    expect(amount(result, "HEALTH_EMPLOYER")).toBe(119_000);
  });

  it("uses only the salary when the employee earns more than 2 minimum wages (no transport allowance)", () => {
    const result = calculateEmployeePayroll(makeEmployee({ baseSalary: 3_000_000 }), makeParameter(), [], PERIOD_START, PERIOD_END, []);

    expect(result.items.some((i) => i.conceptCode === "TRANSPORT_ALLOWANCE")).toBe(false);
    expect(amount(result, "SEVERANCE")).toBe(249_900);
    expect(amount(result, "SERVICE_BONUS")).toBe(249_900);
  });
});

describe("calculateEmployeePayroll -- cumplimiento legal", () => {
  const amount = (result: ReturnType<typeof calculateEmployeePayroll>, code: string) =>
    result.items.find((i) => i.conceptCode === code)?.amount;
  const entry = (clockIn: string, clockOut: string) => ({
    id: clockIn,
    employeeId: "emp-1",
    branchId: "branch-1",
    clockIn: new Date(clockIn),
    clockOut: new Date(clockOut),
    source: "WEB",
    notes: null,
  });

  it("art. 114-1 E.T.: an exempt company skips employer health, ICBF and SENA for workers under 10 SMMLV", () => {
    const result = calculateEmployeePayroll(makeEmployee(), makeParameter(), [], PERIOD_START, PERIOD_END, [], { exemptArt1141: true });

    expect(amount(result, "HEALTH_EMPLOYER")).toBeUndefined();
    expect(amount(result, "ICBF")).toBeUndefined();
    expect(amount(result, "SENA")).toBeUndefined();
    // Caja de compensacion y pension del empleador se siguen pagando.
    expect(amount(result, "CCF")).toBe(56_000);
    expect(amount(result, "PENSION_EMPLOYER")).toBe(168_000);
    expect(result.summary.exemptArt1141).toBe(true);
  });

  it("art. 114-1 E.T.: the exemption does not cover workers earning 10 SMMLV or more", () => {
    const result = calculateEmployeePayroll(makeEmployee({ baseSalary: 15_000_000 }), makeParameter(), [], PERIOD_START, PERIOD_END, [], { exemptArt1141: true });

    expect(amount(result, "HEALTH_EMPLOYER")).toBe(1_275_000);
    expect(amount(result, "SENA")).toBe(300_000);
  });

  it("non-exempt companies (default) pay employer health, ICBF and SENA", () => {
    const result = calculateEmployeePayroll(makeEmployee(), makeParameter(), [], PERIOD_START, PERIOD_END, []);
    expect(amount(result, "HEALTH_EMPLOYER")).toBe(119_000);
    expect(amount(result, "ICBF")).toBe(42_000);
  });

  it("Fondo de Solidaridad Pensional: 1% from 4 SMMLV, rising to 2% from 20 SMMLV", () => {
    expect(solidarityFundPercent(3.99)).toBe(0);
    expect(solidarityFundPercent(4)).toBe(1);
    expect(solidarityFundPercent(16.5)).toBe(1.2);
    expect(solidarityFundPercent(25)).toBe(2);

    const result = calculateEmployeePayroll(makeEmployee({ baseSalary: 6_000_000 }), makeParameter(), [], PERIOD_START, PERIOD_END, []);
    expect(amount(result, "SOLIDARITY_FUND")).toBe(60_000);
  });

  it("caps the contribution base (IBC) at 25 SMMLV", () => {
    const result = calculateEmployeePayroll(makeEmployee({ baseSalary: 40_000_000 }), makeParameter(), [], PERIOD_START, PERIOD_END, []);
    // 25 x 1,400,000 = 35,000,000
    expect(result.summary.ibc).toBe(35_000_000);
    expect(amount(result, "HEALTH_EMPLOYEE")).toBe(1_400_000);
    expect(amount(result, "SOLIDARITY_FUND")).toBe(700_000);
  });

  it("retencion en la fuente, procedimiento 1 (art. 383/385 E.T.)", () => {
    // 10,000,000 - 900,000 de aportes = 9,100,000; exenta 25% = 2,275,000; base 6,825,000 =
    // 139.29 UVT (UVT 49,000) -> (139.29 - 95) x 19% = 8.414 UVT = 412,300 -> 412,000.
    expect(salaryWithholdingTax(10_000_000, 900_000, 49_000)).toBe(412_000);
    expect(salaryWithholdingTax(4_000_000, 320_000, 49_000)).toBe(0);

    const result = calculateEmployeePayroll(makeEmployee({ baseSalary: 10_000_000 }), makeParameter(), [], PERIOD_START, PERIOD_END, []);
    expect(amount(result, "WITHHOLDING_TAX")).toBe(412_000);
    expect(result.netPay).toBe(10_000_000 - 400_000 - 400_000 - 100_000 - 412_000);
  });

  it("Ley 2466 de 2025: dominical surcharge 80% -> 90% (jul 2026) -> 100% (jul 2027), never below the parameter", () => {
    expect(legalSundaySurchargePercent(new Date("2026-06-30T12:00:00-05:00"), 75)).toBe(80);
    expect(legalSundaySurchargePercent(new Date("2026-07-01T12:00:00-05:00"), 75)).toBe(90);
    expect(legalSundaySurchargePercent(new Date("2027-07-02T12:00:00-05:00"), 75)).toBe(100);
    expect(legalSundaySurchargePercent(new Date("2026-07-01T12:00:00-05:00"), 110)).toBe(110);
  });

  it("Ley 2101 de 2021: 42-hour week from 2026-07-15 (hours divisor 210)", () => {
    expect(legalMonthlyHoursDivisor(new Date("2026-07-14T12:00:00-05:00"), 240)).toBe(220);
    expect(legalMonthlyHoursDivisor(new Date("2026-07-20T12:00:00-05:00"), 220)).toBe(210);
    expect(legalMonthlyHoursDivisor(new Date("2026-07-20T12:00:00-05:00"), 200)).toBe(200);
  });

  it("pays a Sunday in July 2026 at 90% with the 210-hour divisor", () => {
    const result = calculateEmployeePayroll(
      makeEmployee(),
      makeParameter(),
      [entry("2026-07-05T08:00:00-05:00", "2026-07-05T12:00:00-05:00")],
      PERIOD_START,
      PERIOD_END,
      []
    );
    // 1,400,000 / 210 = 6,666.67 por hora x 4 h x 90% = 24,000
    expect(amount(result, "SUNDAY_SURCHARGE")).toBe(24_000);
  });

  it("Ley 2466 de 2025: night work starts at 7 p.m. from 2025-12-25 (9 p.m. before)", () => {
    const after = calculateEmployeePayroll(
      makeEmployee(),
      makeParameter(),
      [entry("2026-07-07T19:30:00-05:00", "2026-07-07T23:30:00-05:00")],
      PERIOD_START,
      PERIOD_END,
      []
    );
    expect(after.items.find((i) => i.conceptCode === "NIGHT_SURCHARGE")?.quantity).toBe(4);

    const before = calculateEmployeePayroll(
      makeEmployee(),
      makeParameter(),
      [entry("2025-11-04T19:30:00-05:00", "2025-11-04T23:30:00-05:00")],
      new Date("2025-11-01"),
      new Date("2025-11-30"),
      []
    );
    // Antes del 2025-12-25 el nocturno empezaba a las 9 p. m.: de 7:30 a 9:00 es diurno (1.5 h) y de
    // 9:00 a 11:30 es nocturno (2.5 h) -- la marcacion se divide, no se clasifica en bloque.
    expect(before.items.find((i) => i.conceptCode === "NIGHT_SURCHARGE")?.quantity).toBe(2.5);
  });
});

describe("calculateEmployeePayroll -- jornada, salario integral y soportes de retencion", () => {
  const amount = (result: ReturnType<typeof calculateEmployeePayroll>, code: string) =>
    result.items.find((i) => i.conceptCode === code)?.amount;
  const qty = (result: ReturnType<typeof calculateEmployeePayroll>, code: string) =>
    result.items.find((i) => i.conceptCode === code)?.quantity;
  const entry = (clockIn: string, clockOut: string) => ({
    id: clockIn, employeeId: "emp-1", branchId: "branch-1", clockIn: new Date(clockIn), clockOut: new Date(clockOut), source: "WEB", notes: null,
  });

  it("splits a shift that crosses into night hours (2 p.m. - 11 p.m. = 5 day + 3 night, 1 of them overtime)", () => {
    const result = calculateEmployeePayroll(makeEmployee(), makeParameter(), [entry("2026-07-07T14:00:00-05:00", "2026-07-07T23:00:00-05:00")], PERIOD_START, PERIOD_END, []);
    // 9 horas: las 8 primeras ordinarias (5 diurnas 2-7 p. m. + 3 nocturnas 7-10 p. m.), la novena extra nocturna.
    expect(qty(result, "NIGHT_SURCHARGE")).toBe(3);
    expect(qty(result, "OVERTIME_NIGHT")).toBe(1);
    expect(result.items.some((i) => i.conceptCode === "OVERTIME_DAY")).toBe(false);
  });

  it("adds up several clock-ins on the same day before counting overtime", () => {
    const result = calculateEmployeePayroll(
      makeEmployee(),
      makeParameter(),
      [entry("2026-07-07T07:00:00-05:00", "2026-07-07T12:00:00-05:00"), entry("2026-07-07T13:00:00-05:00", "2026-07-07T18:00:00-05:00")],
      PERIOD_START,
      PERIOD_END,
      []
    );
    // 5 + 5 = 10 horas en el dia: 2 extra diurnas.
    expect(qty(result, "OVERTIME_DAY")).toBe(2);
  });

  it("charges the Sunday surcharge on Sunday overtime too", () => {
    const result = calculateEmployeePayroll(makeEmployee(), makeParameter(), [entry("2026-07-05T08:00:00-05:00", "2026-07-05T18:00:00-05:00")], PERIOD_START, PERIOD_END, []);
    // 10 horas de domingo: 8 ordinarias + 2 extra, todas con 90% dominical.
    expect(qty(result, "SUNDAY_SURCHARGE")).toBe(10);
    expect(qty(result, "OVERTIME_DAY")).toBe(2);
    // 1,400,000 / 210 x 10 h x 90% = 60,000
    expect(amount(result, "SUNDAY_SURCHARGE")).toBe(60_000);
  });

  it("salario integral: contributions on 70%, no transport allowance, severance or service bonus", () => {
    const result = calculateEmployeePayroll(makeEmployee({ baseSalary: 20_000_000, salaryType: "INTEGRAL" }), makeParameter(), [], PERIOD_START, PERIOD_END, []);
    expect(result.summary.ibc).toBe(14_000_000);
    expect(amount(result, "HEALTH_EMPLOYEE")).toBe(560_000);
    expect(amount(result, "TRANSPORT_ALLOWANCE")).toBeUndefined();
    expect(amount(result, "SEVERANCE")).toBeUndefined();
    expect(amount(result, "SERVICE_BONUS")).toBeUndefined();
    // Vacaciones si, sobre el salario completo.
    expect(amount(result, "VACATION")).toBe(834_000);
  });

  it("withholding: dependents, housing interest, prepaid health and voluntary pension lower the base, within the caps", () => {
    const base = salaryWithholdingTax(10_000_000, 900_000, 49_000);
    const withSupports = salaryWithholdingTax(10_000_000, 900_000, 49_000, {
      dependents: true,
      housingInterest: 1_000_000,
      prepaidHealth: 300_000,
      voluntaryPension: 500_000,
    });
    // Deducciones: dependientes 10% = 1,000,000 (tope 32 UVT = 1,568,000), vivienda 1,000,000,
    // prepagada tope 16 UVT = 784,000 -> 300,000; voluntarios 500,000; 25% de (9,100,000 - 2,800,000)
    // = 1,575,000. Total 4,375,000 > 40% de 9,100,000 = 3,640,000 -> se topa en 3,640,000.
    // Base 5,460,000 = 111.43 UVT -> (111.43 - 95) x 19% = 3.12 UVT = 152,950 -> 153,000.
    expect(base).toBe(412_000);
    expect(withSupports).toBe(153_000);
  });
});

describe("calculateEmployeePayroll -- quincenas y mes comercial", () => {
  const d = (iso: string) => new Date(iso + "T00:00:00.000Z");
  const hire = d("2024-01-10");

  it("each fortnight is 15 days and every month 30, whatever its length", () => {
    expect(daysWorkedInPeriod(d("2026-11-01"), d("2026-11-15"), hire, null)).toBe(15);
    expect(daysWorkedInPeriod(d("2026-11-16"), d("2026-11-30"), hire, null)).toBe(15);
    expect(daysWorkedInPeriod(d("2026-10-16"), d("2026-10-31"), hire, null)).toBe(15);
    expect(daysWorkedInPeriod(d("2026-02-16"), d("2026-02-28"), hire, null)).toBe(15);
    expect(daysWorkedInPeriod(d("2026-02-01"), d("2026-02-28"), hire, null)).toBe(30);
    expect(daysWorkedInPeriod(d("2026-12-01"), d("2026-12-31"), hire, null)).toBe(30);
    // Retiro el 20: del 16 al 20 son 5 dias.
    expect(daysWorkedInPeriod(d("2026-11-16"), d("2026-11-30"), hire, d("2026-11-20"))).toBe(5);
  });

  it("a fortnight pays half the salary and half the transport allowance", () => {
    const first = calculateEmployeePayroll(makeEmployee(), makeParameter(), [], d("2026-10-01"), d("2026-10-15"), []);
    const second = calculateEmployeePayroll(makeEmployee(), makeParameter(), [], d("2026-10-16"), d("2026-10-31"), []);
    expect(first.items.find((i) => i.conceptCode === "SALARY")?.amount).toBe(700_000);
    expect(second.items.find((i) => i.conceptCode === "SALARY")?.amount).toBe(700_000);
    expect(second.items.find((i) => i.conceptCode === "TRANSPORT_ALLOWANCE")?.amount).toBe(100_000);
  });

  it("fortnight withholding is half of the monthly one, not computed on the half payment alone", () => {
    const monthly = calculateEmployeePayroll(makeEmployee({ baseSalary: 10_000_000 }), makeParameter(), [], d("2026-10-01"), d("2026-10-31"), []);
    const fortnight = calculateEmployeePayroll(makeEmployee({ baseSalary: 10_000_000 }), makeParameter(), [], d("2026-10-01"), d("2026-10-15"), []);
    const tax = (r: ReturnType<typeof calculateEmployeePayroll>) => r.items.find((i) => i.conceptCode === "WITHHOLDING_TAX")?.amount ?? 0;
    expect(tax(monthly)).toBe(412_000);
    expect(tax(fortnight)).toBe(206_000);
  });
});

describe("payslipPeriodLabel", () => {
  const d = (iso: string) => new Date(iso + "T00:00:00.000Z");
  it("names the fortnight or the month", () => {
    expect(payslipPeriodLabel(d("2026-11-01"), d("2026-11-15"))).toBe("Primera quincena de noviembre de 2026");
    expect(payslipPeriodLabel(d("2026-02-16"), d("2026-02-28"))).toBe("Segunda quincena de febrero de 2026");
    expect(payslipPeriodLabel(d("2026-12-01"), d("2026-12-31"))).toBe("Diciembre de 2026");
  });
});
