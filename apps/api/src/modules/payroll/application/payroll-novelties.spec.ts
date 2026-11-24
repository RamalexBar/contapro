import { describe, expect, it } from "vitest";
import type { EmployeeRecord } from "../../employees/domain/employee.repository";
import type { PayrollParameterRecord } from "../domain/payroll-parameter.repository";
import { calculateEmployeePayroll } from "./payroll-calculator";
import { computeNovelties, vacationBusinessDaysBetween, type PayrollNovelty } from "./payroll-novelties";

const d = (iso: string) => new Date(`${iso}T00:00:00.000Z`);
const MIN_WAGE = 1_750_905; // 2026
const NOV_START = d("2026-11-01");
const NOV_END = d("2026-11-30");

function novelties(salary: number, list: PayrollNovelty[], from = NOV_START, to = NOV_END) {
  return computeNovelties({ novelties: list, from, to, baseSalary: salary, minimumWage: MIN_WAGE });
}

describe("computeNovelties — incapacidad de origen comun", () => {
  it("pays days 1-2 by the employer and from day 3 by the EPS, at 2/3 of the salary", () => {
    const n = novelties(3_000_000, [{ kind: "SICK_GENERAL", startDate: d("2026-11-03"), endDate: d("2026-11-07") }]);
    // 3.000.000 / 30 = 100.000 diarios; 2/3 = 66.666,67
    expect(n.sickGeneralEmployerDays).toBe(2);
    expect(n.sickGeneralEmployerAmount).toBe(133_333.33);
    expect(n.sickGeneralEpsDays).toBe(3);
    expect(n.sickGeneralEpsAmount).toBe(200_000);
    expect(n.totalNoveltyDays).toBe(5);
  });

  it("never pays less than the daily minimum wage (Sentencia C-543 de 2007)", () => {
    const n = novelties(2_000_000, [{ kind: "SICK_GENERAL", startDate: d("2026-11-03"), endDate: d("2026-11-03") }]);
    // 2/3 de 66.666,67 = 44.444 < minimo diario 58.363,50
    expect(n.sickGeneralEmployerAmount).toBe(58_363.5);
  });

  it("keeps counting from the real start when the incapacity began in the previous period", () => {
    const n = novelties(3_000_000, [{ kind: "SICK_GENERAL", startDate: d("2026-10-30"), endDate: d("2026-11-02") }]);
    // 30 y 31 de octubre son los dias 1 y 2 (fuera del periodo); 1 y 2 de noviembre ya son de la EPS.
    expect(n.sickGeneralEmployerDays).toBe(0);
    expect(n.sickGeneralEpsDays).toBe(2);
  });

  it("drops to 1/2 of the salary from day 91", () => {
    const n = novelties(6_000_000, [{ kind: "SICK_GENERAL", startDate: d("2026-08-05"), endDate: d("2026-11-30") }]);
    // 5 de agosto + 90 dias = 2 de noviembre es el dia 90; desde el 3 de noviembre, mitad del salario.
    const daily = 200_000;
    expect(n.sickGeneralEpsAmount).toBe(Math.round((2 * daily * (2 / 3) + 28 * daily * 0.5) * 100) / 100);
  });
});

describe("computeNovelties — otras novedades", () => {
  it("pays the work injury at 100% from the day after the accident (the accident day is salary)", () => {
    const n = novelties(3_000_000, [{ kind: "SICK_LABOR", startDate: d("2026-11-10"), endDate: d("2026-11-14") }]);
    expect(n.sickLaborArlDays).toBe(4);
    expect(n.sickLaborArlAmount).toBe(400_000);
    expect(n.totalNoveltyDays).toBe(4);
  });

  it("splits vacations into business days (vacation pay) and Sundays/holidays (salary)", () => {
    // 9 al 21 de noviembre de 2026: domingo 15 y festivo lunes 16 (Independencia de Cartagena).
    const n = novelties(3_000_000, [{ kind: "VACATION", startDate: d("2026-11-09"), endDate: d("2026-11-21") }]);
    expect(n.vacationBusinessDays).toBe(11);
    expect(n.vacationRestDays).toBe(2);
    expect(n.vacationAmount).toBe(1_100_000);
    expect(vacationBusinessDaysBetween(d("2026-11-09"), d("2026-11-21"))).toBe(11);
  });

  it("does not count the 31st and counts the last day of February up to 30 (commercial month)", () => {
    const dec = novelties(3_000_000, [{ kind: "UNPAID_LEAVE", startDate: d("2026-12-30"), endDate: d("2026-12-31") }], d("2026-12-01"), d("2026-12-31"));
    expect(dec.unpaidDays).toBe(1);
    const feb = novelties(3_000_000, [{ kind: "UNPAID_LEAVE", startDate: d("2026-02-27"), endDate: d("2026-02-28") }], d("2026-02-01"), d("2026-02-28"));
    expect(feb.unpaidDays).toBe(4); // 27 = 1 dia, 28 (ultimo de febrero) = 3 dias
  });

  it("gives maternity priority over a vacation registered on the same days", () => {
    const n = novelties(3_000_000, [
      { kind: "VACATION", startDate: d("2026-11-09"), endDate: d("2026-11-13") },
      { kind: "MATERNITY", startDate: d("2026-11-11"), endDate: d("2026-11-30") },
    ]);
    expect(n.maternityDays).toBe(20);
    expect(n.vacationBusinessDays).toBe(2); // 9 y 10
  });
});

function parameter(): PayrollParameterRecord {
  return {
    id: "p",
    year: 2026,
    effectiveFrom: d("2026-01-01"),
    effectiveTo: null,
    minimumWage: MIN_WAGE,
    transportAllowance: 249_095,
    uvt: 52_374,
    healthEmployeePercent: 4,
    healthEmployerPercent: 8.5,
    pensionEmployeePercent: 4,
    pensionEmployerPercent: 12,
    arlPercentByRiskLevel: { I: 0.522 },
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
  };
}

function employee(baseSalary: number): EmployeeRecord {
  return {
    id: "emp-1",
    companyId: "c",
    branchId: "b",
    userId: null,
    documentType: "CC",
    documentNumber: "1",
    firstName: "Ana",
    lastName: "Rios",
    middleName: null,
    secondLastName: null,
    workerType: "01",
    workerSubtype: "00",
    birthDate: null,
    address: null,
    phone: null,
    email: null,
    position: "Vendedora",
    contractType: "INDEFINITE",
    baseSalary,
    hireDate: d("2024-01-01"),
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
  } as EmployeeRecord;
}

const item = (r: ReturnType<typeof calculateEmployeePayroll>, code: string) => r.items.find((i) => i.conceptCode === code);

describe("calculateEmployeePayroll con novedades", () => {
  it("without novelties keeps paying the full month as before", () => {
    const r = calculateEmployeePayroll(employee(2_000_000), parameter(), [], NOV_START, NOV_END, [], undefined, []);
    expect(item(r, "SALARY")?.amount).toBe(2_000_000);
    expect(item(r, "TRANSPORT_ALLOWANCE")?.amount).toBe(249_095);
  });

  it("vacations: same total pay, no transport allowance on vacation days, vacation pay on its own line", () => {
    const r = calculateEmployeePayroll(employee(3_000_000), parameter(), [], NOV_START, NOV_END, [], undefined, [
      { kind: "VACATION", startDate: d("2026-11-09"), endDate: d("2026-11-21") },
    ]);
    // 30 - 13 dias de vacaciones + 2 domingos/festivos = 19 dias de salario; 11 habiles de vacaciones.
    expect(item(r, "SALARY")).toEqual(expect.objectContaining({ quantity: 19, amount: 1_900_000 }));
    expect(item(r, "VACATION_PAY")).toEqual(expect.objectContaining({ quantity: 11, amount: 1_100_000 }));
    // Gana menos de 2 SMMLV: auxilio solo por los 17 dias trabajados.
    expect(item(r, "TRANSPORT_ALLOWANCE")).toEqual(expect.objectContaining({ quantity: 17, amount: Math.round((249_095 / 30) * 17 * 100) / 100 }));
    // Cotiza salud sobre todo (salario + vacaciones), ARL solo por los 17 dias trabajados.
    expect(item(r, "HEALTH_EMPLOYEE")?.amount).toBe(120_000);
    expect(item(r, "ARL")?.amount).toBe(Math.round(1_700_000 * 0.00522 * 100) / 100);
    // Las prestaciones siguen sobre el salario del mes completo (mas el auxilio pagado, Ley 1 de 1963).
    const transport = item(r, "TRANSPORT_ALLOWANCE")!.amount;
    expect(item(r, "SEVERANCE")?.amount).toBe(Math.round((3_000_000 + transport) * 0.0833 * 100) / 100);
    expect(item(r, "VACATION")?.amount).toBe(Math.round(3_000_000 * 0.0417 * 100) / 100);
  });

  it("incapacity: pays 2/3, recovers from the EPS from day 3, no transport, no parafiscales and exempt from withholding", () => {
    const r = calculateEmployeePayroll(employee(1_750_905), parameter(), [], NOV_START, NOV_END, [], undefined, [
      { kind: "SICK_GENERAL", startDate: d("2026-11-03"), endDate: d("2026-11-12") },
    ]);
    const daily = 1_750_905 / 30; // salario minimo: la incapacidad queda en el minimo diario
    expect(item(r, "SALARY")?.quantity).toBe(20);
    expect(item(r, "SICK_LEAVE_EMPLOYER")).toEqual(expect.objectContaining({ quantity: 2, amount: Math.round(daily * 2 * 100) / 100 }));
    expect(item(r, "SICK_LEAVE_EPS")).toEqual(expect.objectContaining({ quantity: 8, amount: Math.round(daily * 8 * 100) / 100 }));
    expect(item(r, "TRANSPORT_ALLOWANCE")).toEqual(expect.objectContaining({ quantity: 20 }));
    // Caja de compensacion solo sobre el salario de los 20 dias (la incapacidad no es salario).
    expect(item(r, "CCF")?.amount).toBe(Math.round(daily * 20 * 0.04 * 100) / 100);
    expect((r.summary as { recoverableFromSocialSecurity: number }).recoverableFromSocialSecurity).toBe(Math.round(daily * 8 * 100) / 100);
  });

  it("unpaid leave: discounts the days, keeps the employer pension and leaves them out of the benefits", () => {
    const r = calculateEmployeePayroll(employee(2_000_000), parameter(), [], NOV_START, NOV_END, [], undefined, [
      { kind: "UNPAID_LEAVE", startDate: d("2026-11-23"), endDate: d("2026-11-25") },
    ]);
    const daily = 2_000_000 / 30;
    expect(item(r, "SALARY")?.amount).toBe(Math.round(daily * 27 * 100) / 100);
    expect(item(r, "UNPAID_LEAVE")).toEqual(expect.objectContaining({ quantity: 3, amount: 0 }));
    expect(item(r, "TRANSPORT_ALLOWANCE")?.quantity).toBe(27);
    expect(item(r, "HEALTH_EMPLOYEE")?.amount).toBe(Math.round(daily * 27 * 0.04 * 100) / 100);
    // Pension del empleador: 12 % del salario de los 27 dias + los 3 no remunerados (mes completo).
    expect(item(r, "PENSION_EMPLOYER")?.amount).toBe(240_000);
    const transport = item(r, "TRANSPORT_ALLOWANCE")!.amount;
    expect(item(r, "SEVERANCE")?.amount).toBe(Math.round((daily * 27 + transport) * 0.0833 * 100) / 100);
  });

  it("maternity: the whole month is paid by the EPS at 100% and still counts for benefits", () => {
    const r = calculateEmployeePayroll(employee(2_400_000), parameter(), [], NOV_START, NOV_END, [], undefined, [
      { kind: "MATERNITY", startDate: d("2026-10-01"), endDate: d("2027-02-03") },
    ]);
    expect(item(r, "SALARY")?.amount ?? 0).toBe(0);
    expect(item(r, "MATERNITY_LEAVE")?.amount).toBe(2_400_000);
    expect(item(r, "WITHHOLDING_TAX")).toBeUndefined();
    expect(item(r, "SEVERANCE")?.amount).toBe(Math.round(2_400_000 * 0.0833 * 100) / 100);
    expect(r.grossTotal).toBe(2_400_000);
  });
});
