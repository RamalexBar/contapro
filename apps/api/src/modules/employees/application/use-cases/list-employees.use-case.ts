import type { EmployeeRecord, IEmployeeRepository } from "../../domain/employee.repository";

export class ListEmployeesUseCase {
  constructor(private readonly repo: IEmployeeRepository) {}

  async execute(filter?: { branchId?: string; status?: string }): Promise<EmployeeRecord[]> {
    return this.repo.list(filter);
  }
}
