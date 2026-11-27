/**
 * Bonificacion NO salarial de un empleado (art. 128 CST): un pago ocasional que se incluye en la nomina
 * cuyo periodo contiene `date`. No suma a prestaciones ni a parafiscales; solo cotiza salud y pension
 * el excedente sobre el 40% del total devengado (art. 30 Ley 1393 de 2010). Ver payroll-calculator.ts.
 */
export interface PayrollBonusRecord {
  id: string;
  employeeId: string;
  date: Date;
  amount: number;
  description: string;
  status: "ACTIVE" | "CANCELLED";
  createdAt: Date;
}

export interface CreatePayrollBonusData {
  employeeId: string;
  date: Date;
  amount: number;
  description: string;
  createdByUserId: string;
}

export interface IPayrollBonusRepository {
  create(data: CreatePayrollBonusData): Promise<PayrollBonusRecord>;
  findByIdOrThrow(id: string): Promise<PayrollBonusRecord>;
  list(filter?: { employeeId?: string }): Promise<PayrollBonusRecord[]>;
  /** Bonificaciones ACTIVE del empleado con fecha dentro del periodo (lo que el calculo incluye). */
  listActiveForPeriod(employeeId: string, from: Date, to: Date): Promise<PayrollBonusRecord[]>;
  /** true si la fecha cae en una nomina ya aprobada o pagada de ese empleado (no se puede cancelar). */
  isInClosedPayroll(bonus: PayrollBonusRecord): Promise<boolean>;
  cancel(id: string): Promise<PayrollBonusRecord>;
}
