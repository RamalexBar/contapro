import type { CreateEmployeeInput } from "@erp/shared-types";
import { isValidCedula } from "@erp/shared-utils";
import { ValidationError } from "../../../../shared/errors/app-error";
import type { AuditService } from "../../../audit/application/audit.service";
import type { EmployeeRecord, IEmployeeRepository } from "../../domain/employee.repository";

export class CreateEmployeeUseCase {
  constructor(private readonly repo: IEmployeeRepository, private readonly audit: AuditService) {}

  async execute(input: CreateEmployeeInput): Promise<EmployeeRecord> {
    if (input.documentType === "CC" && !isValidCedula(input.documentNumber)) {
      throw new ValidationError("Numero de cedula invalido");
    }

    const employee = await this.repo.create(input);

    await this.audit.record({
      action: "EMPLOYEE_CREATED",
      entityType: "Employee",
      entityId: employee.id,
      description: `Empleado creado: ${employee.firstName} ${employee.lastName} (${employee.documentNumber})`,
    });

    return employee;
  }
}
