import type { AuditService } from "../../../audit/application/audit.service";
import type { EmployeeRecord, IEmployeeRepository } from "../../domain/employee.repository";

export class DeactivateEmployeeUseCase {
  constructor(private readonly repo: IEmployeeRepository, private readonly audit: AuditService) {}

  async execute(id: string, terminationDate: Date): Promise<EmployeeRecord> {
    const employee = await this.repo.deactivate(id, terminationDate);

    await this.audit.record({
      action: "EMPLOYEE_DEACTIVATED",
      entityType: "Employee",
      entityId: employee.id,
      description: `Empleado dado de baja: ${employee.firstName} ${employee.lastName}`,
      metadata: { terminationDate: terminationDate.toISOString() },
    });

    return employee;
  }
}
