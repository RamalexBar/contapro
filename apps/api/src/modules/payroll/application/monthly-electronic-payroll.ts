import { round2 } from "@erp/shared-utils";
import type { PayrollWithDetails } from "../domain/payroll.repository";

/** Una nomina en estos estados ya no cambia: se puede reportar a la DIAN. */
const CLOSED_STATUSES = new Set(["APPROVED", "PAID"]);
const DAY_MS = 86_400_000;

export interface MonthlyElectronicPayroll {
  employeeId: string;
  /** Detalle al que queda ligado el documento: el de la ultima nomina del mes del empleado. */
  payrollDetailId: string;
  periodicity: "MONTHLY" | "BIWEEKLY";
  periodStart: Date;
  periodEnd: Date;
  paymentDates: Date[];
  daysWorked: number;
  grossTotal: number;
  totalDeductions: number;
  netPay: number;
  items: Array<{ conceptCode: string; quantity: number | null; rate: number | null; amount: number }>;
}

function isLastDayOfMonth(date: Date): boolean {
  return new Date(date.getTime() + DAY_MS).getUTCDate() === 1;
}

/**
 * La nomina electronica se transmite una vez al mes por empleado (Res. DIAN 000013 de 2021). Devuelve
 * null si el mes todavia no esta completo: falta la nomina que llega al ultimo dia del mes, o alguna
 * nomina del mes sigue sin aprobar. Si esta completo, suma por empleado todas las nominas aprobadas
 * del mes (las dos quincenas, o las de varias sucursales).
 */
export function buildMonthlyElectronicPayrolls(year: number, month: number, payrolls: PayrollWithDetails[]): MonthlyElectronicPayroll[] | null {
  if (payrolls.length === 0) return null;
  if (payrolls.some((p) => !CLOSED_STATUSES.has(p.status))) return null;
  if (!payrolls.some((p) => isLastDayOfMonth(p.endDate))) return null;

  const periodStart = new Date(Date.UTC(year, month - 1, 1));
  const periodEnd = new Date(Date.UTC(year, month, 0));
  const byEmployee = new Map<string, MonthlyElectronicPayroll>();
  const sorted = [...payrolls].sort((a, b) => a.endDate.getTime() - b.endDate.getTime());

  for (const payroll of sorted) {
    for (const detail of payroll.details) {
      let acc = byEmployee.get(detail.employeeId);
      if (!acc) {
        acc = {
          employeeId: detail.employeeId,
          payrollDetailId: detail.id,
          periodicity: "MONTHLY",
          periodStart,
          periodEnd,
          paymentDates: [],
          daysWorked: 0,
          grossTotal: 0,
          totalDeductions: 0,
          netPay: 0,
          items: [],
        };
        byEmployee.set(detail.employeeId, acc);
      }
      acc.payrollDetailId = detail.id;
      if (payroll.periodType === "BIWEEKLY") acc.periodicity = "BIWEEKLY";
      acc.paymentDates.push(payroll.endDate);
      acc.grossTotal = round2(acc.grossTotal + detail.grossTotal);
      acc.totalDeductions = round2(acc.totalDeductions + detail.totalDeductions);
      acc.netPay = round2(acc.netPay + detail.netPay);
      for (const item of detail.items) {
        if (item.conceptCode === "SALARY") acc.daysWorked = round2(acc.daysWorked + (item.quantity ?? 0));
        const existing = acc.items.find((i) => i.conceptCode === item.conceptCode);
        if (existing) {
          existing.amount = round2(existing.amount + item.amount);
          existing.quantity = existing.quantity === null && item.quantity === null ? null : round2((existing.quantity ?? 0) + (item.quantity ?? 0));
          existing.rate = existing.rate ?? item.rate;
        } else {
          acc.items.push({ conceptCode: item.conceptCode, quantity: item.quantity, rate: item.rate, amount: item.amount });
        }
      }
    }
  }
  return [...byEmployee.values()];
}
