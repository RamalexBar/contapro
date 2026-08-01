import type { IPayrollDeductionRepository, PayrollDeductionRecord, PayrollDeductionStatus } from "../../domain/payroll-deduction.repository";

export class ListPayrollDeductionsUseCase {
  constructor(private readonly repo: IPayrollDeductionRepository) {}

  execute(filter?: { employeeId?: string; status?: PayrollDeductionStatus }): Promise<PayrollDeductionRecord[]> {
    return this.repo.list(filter);
  }
}
