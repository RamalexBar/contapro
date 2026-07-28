import type { UpdateEmployeeInput } from "@erp/shared-types";
import type { AuditService } from "../../../audit/application/audit.service";
import type { EmployeeRecord, IEmployeeRepository } from "../../domain/employee.repository";

export class UpdateEmployeeUseCase {
  constructor(private readonly repo: IEmployeeRepository, private readonly audit: AuditService) {}

  async execute(id: string, input: UpdateEmployeeInput): Promise<EmployeeRecord> {
    const employee = await this.repo.update(id, input);

    await this.audit.record({
      action: "EMPLOYEE_UPDATED",
      entityType: "Employee",
      entityId: employee.id,
      description: `Empleado actualizado: ${employee.firstName} ${employee.lastName}`,
    });

    return employee;
  }
}
