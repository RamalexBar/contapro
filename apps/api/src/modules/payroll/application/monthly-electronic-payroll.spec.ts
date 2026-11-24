import { describe, expect, it } from "vitest";
import type { PayrollWithDetails } from "../domain/payroll.repository";
import { buildMonthlyElectronicPayrolls } from "./monthly-electronic-payroll";

const d = (iso: string) => new Date(`${iso}T00:00:00.000Z`);

function payroll(id: string, start: string, end: string, status: string, salary: number): PayrollWithDetails {
  return {
    id,
    companyId: "c",
    branchId: null,
    year: 2026,
    month: 12,
    periodType: "BIWEEKLY",
    startDate: d(start),
    endDate: d(end),
    status,
    createdByUserId: "u",
    calculatedAt: null,
    paidAt: null,
    details: [
      {
        id: `${id}-det`,
        employeeId: "emp-1",
        grossTotal: salary,
        totalDeductions: salary * 0.08,
        netPay: salary * 0.92,
        employerCostTotal: 0,
        status: "PENDING",
        items: [
          { id: `${id}-1`, conceptCode: "SALARY", quantity: 15, rate: salary / 15, amount: salary, payrollDeductionId: null },
          { id: `${id}-2`, conceptCode: "HEALTH_EMPLOYEE", quantity: null, rate: 4, amount: salary * 0.04, payrollDeductionId: null },
        ],
        payslip: null,
      },
    ],
  };
}

describe("buildMonthlyElectronicPayrolls", () => {
  it("waits while the second fortnight is missing", () => {
    expect(buildMonthlyElectronicPayrolls(2026, 12, [payroll("q1", "2026-12-01", "2026-12-15", "APPROVED", 1_000_000)])).toBeNull();
  });

  it("waits while a payroll of the month is not approved yet", () => {
    const result = buildMonthlyElectronicPayrolls(2026, 12, [
      payroll("q1", "2026-12-01", "2026-12-15", "CALCULATED", 1_000_000),
      payroll("q2", "2026-12-16", "2026-12-31", "APPROVED", 1_000_000),
    ]);
    expect(result).toBeNull();
  });

  it("adds both fortnights into one document per employee, linked to the last one", () => {
    const [doc] = buildMonthlyElectronicPayrolls(2026, 12, [
      payroll("q2", "2026-12-16", "2026-12-31", "PAID", 1_100_000),
      payroll("q1", "2026-12-01", "2026-12-15", "APPROVED", 1_000_000),
    ])!;
    expect(doc!.payrollDetailId).toBe("q2-det");
    expect(doc!.periodicity).toBe("BIWEEKLY");
    expect(doc!.periodStart).toEqual(d("2026-12-01"));
    expect(doc!.periodEnd).toEqual(d("2026-12-31"));
    expect(doc!.paymentDates).toEqual([d("2026-12-15"), d("2026-12-31")]);
    expect(doc!.daysWorked).toBe(30);
    expect(doc!.grossTotal).toBe(2_100_000);
    expect(doc!.items.find((i) => i.conceptCode === "SALARY")).toEqual({ conceptCode: "SALARY", quantity: 30, rate: 1_000_000 / 15, amount: 2_100_000 });
    expect(doc!.items.find((i) => i.conceptCode === "HEALTH_EMPLOYEE")).toEqual({ conceptCode: "HEALTH_EMPLOYEE", quantity: null, rate: 4, amount: 84_000 });
  });
});
