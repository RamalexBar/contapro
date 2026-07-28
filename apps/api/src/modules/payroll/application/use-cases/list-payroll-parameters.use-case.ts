import type { IPayrollParameterRepository, PayrollParameterRecord } from "../../domain/payroll-parameter.repository";

export class ListPayrollParametersUseCase {
  constructor(private readonly repo: IPayrollParameterRepository) {}

  async execute(): Promise<PayrollParameterRecord[]> {
    return this.repo.list();
  }
}
