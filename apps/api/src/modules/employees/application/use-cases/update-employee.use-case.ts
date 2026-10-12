import type { UpdateEmployeeInput } from "@erp/shared-types";
import { ValidationError } from "../../../../shared/errors/app-error";
import type { AuditService } from "../../../audit/application/audit.service";
import type { EmployeeRecord, IEmployeeRepository } from "../../domain/employee.repository";

export class UpdateEmployeeUseCase {
  constructor(private readonly repo: IEmployeeRepository, private readonly audit: AuditService) {}

  async execute(id: string, input: UpdateEmployeeInput): Promise<EmployeeRecord> {
    if (input.userId) {
      if (!(await this.repo.userExists(input.userId))) throw new ValidationError("Ese usuario no existe en la empresa");
      const linked = await this.repo.findByUserId(input.userId);
      if (linked && linked.id !== id) {
        throw new ValidationError(`Ese usuario ya esta vinculado al empleado ${linked.firstName} ${linked.lastName}`);
      }
    }

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
