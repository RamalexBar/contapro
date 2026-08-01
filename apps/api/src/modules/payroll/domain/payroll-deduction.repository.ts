export type PayrollDeductionType = "LOAN_DEDUCTION" | "GARNISHMENT";
export type PayrollDeductionStatus = "ACTIVE" | "COMPLETED" | "CANCELLED";

export interface PayrollDeductionRecord {
  id: string;
  employeeId: string;
  type: PayrollDeductionType;
  description: string;
  amountPerPeriod: number;
  /** null = indefinido (tipico de un embargo sin monto total conocido de antemano). */
  totalAmount: number | null;
  /** null junto con totalAmount -- no hay saldo que descontar, se aplica siempre el monto por
   * periodo hasta que alguien la cancele manualmente. */
  remainingBalance: number | null;
  status: PayrollDeductionStatus;
  startDate: Date;
  createdAt: Date;
}

export interface CreatePayrollDeductionData {
  employeeId: string;
  type: PayrollDeductionType;
  description: string;
  amountPerPeriod: number;
  totalAmount?: number;
  startDate: Date;
  createdByUserId: string;
}

export interface IPayrollDeductionRepository {
  create(data: CreatePayrollDeductionData): Promise<PayrollDeductionRecord>;
  findByIdOrThrow(id: string): Promise<PayrollDeductionRecord>;
  list(filter?: { employeeId?: string; status?: PayrollDeductionStatus }): Promise<PayrollDeductionRecord[]>;
  /** Deducciones ACTIVE de un empleado -- lo que el motor de liquidacion aplica cada periodo. */
  listActiveForEmployee(employeeId: string): Promise<PayrollDeductionRecord[]>;
  cancel(id: string): Promise<PayrollDeductionRecord>;
  /**
   * Descuenta `amount` de remainingBalance (no-op si es null, ej. embargo indefinido) y pasa a
   * COMPLETED si llega a 0. Se llama al APROBAR un periodo, nunca al calcularlo -- calcular es
   * re-ejecutable (recalcular sobreescribe el detalle anterior) y descontar ahi duplicaria el
   * descuento en cada recalculo; aprobar es el punto sin retorno, igual que la contabilizacion
   * automatica y la generacion de nomina electronica (ver ApprovePayrollUseCase).
   */
  applyPeriodAmount(id: string, amount: number): Promise<PayrollDeductionRecord>;
}
