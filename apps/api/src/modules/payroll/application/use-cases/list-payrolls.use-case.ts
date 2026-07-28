import type { IPayrollRepository, PayrollRecord } from "../../domain/payroll.repository";

export class ListPayrollsUseCase {
  constructor(private readonly repo: IPayrollRepository) {}

  async execute(filter?: { year?: number; branchId?: string }): Promise<PayrollRecord[]> {
    return this.repo.list(filter);
  }
}
