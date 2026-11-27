/**
 * Comisiones de ventas (modulo commissions) de un empleado vendedor: son salario (art. 127 CST), asi que
 * se pagan en la nomina y no por aparte. El vendedor se identifica por el usuario de Contapro vinculado
 * al empleado (Employee.userId = CommissionSettlement.sellerUserId).
 */
export interface PendingCommission {
  id: string;
  amount: number;
}

export interface IPayrollCommissionReader {
  /** Liquidaciones de comision del mes aun sin pagar (CALCULATED) del vendedor vinculado al empleado. */
  pendingForEmployee(employeeId: string, year: number, month: number): Promise<PendingCommission[]>;
  /** Las marca pagadas dentro de esa nomina (su gasto va en el comprobante de la nomina). */
  markPaidInPayroll(ids: string[], payrollId: string): Promise<void>;
}

/** En nomina quincenal las comisiones del mes van en la segunda quincena (la que cierra el mes). */
export function payrollIncludesMonthCommissions(payroll: { periodType: string; endDate: Date }): boolean {
  if (payroll.periodType !== "BIWEEKLY") return true;
  const end = payroll.endDate;
  const lastDay = new Date(Date.UTC(end.getUTCFullYear(), end.getUTCMonth() + 1, 0)).getUTCDate();
  return end.getUTCDate() === lastDay;
}
