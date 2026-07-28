import { PrismaAuditLogRepository } from "../audit/infrastructure/prisma-audit-log.repository";
import { AuditService } from "../audit/application/audit.service";
import { PrismaEmployeeRepository } from "./infrastructure/prisma-employee.repository";
import { CreateEmployeeUseCase } from "./application/use-cases/create-employee.use-case";
import { ListEmployeesUseCase } from "./application/use-cases/list-employees.use-case";
import { UpdateEmployeeUseCase } from "./application/use-cases/update-employee.use-case";
import { DeactivateEmployeeUseCase } from "./application/use-cases/deactivate-employee.use-case";
import { EmployeeController } from "./interfaces/employee.controller";

const employeeRepo = new PrismaEmployeeRepository();
const auditService = new AuditService(new PrismaAuditLogRepository());

export const employeeController = new EmployeeController(
  employeeRepo,
  new CreateEmployeeUseCase(employeeRepo, auditService),
  new ListEmployeesUseCase(employeeRepo),
  new UpdateEmployeeUseCase(employeeRepo, auditService),
  new DeactivateEmployeeUseCase(employeeRepo, auditService)
);

export { employeeRepo };
