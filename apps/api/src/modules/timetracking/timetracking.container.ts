import { PrismaAuditLogRepository } from "../audit/infrastructure/prisma-audit-log.repository";
import { AuditService } from "../audit/application/audit.service";
import { employeeRepo } from "../employees/employees.container";
import { PrismaTimeTrackingRepository } from "./infrastructure/prisma-timetracking.repository";
import { PrismaTimeOffRepository } from "./infrastructure/prisma-time-off.repository";
import { ClockInUseCase } from "./application/use-cases/clock-in.use-case";
import { ClockOutUseCase } from "./application/use-cases/clock-out.use-case";
import { ListTimeEntriesUseCase } from "./application/use-cases/list-time-entries.use-case";
import { RequestVacationUseCase } from "./application/use-cases/request-vacation.use-case";
import { RequestLeavePermissionUseCase } from "./application/use-cases/request-leave-permission.use-case";
import { RegisterAbsenceUseCase } from "./application/use-cases/register-absence.use-case";
import { SubmitSickLeaveUseCase } from "./application/use-cases/submit-sick-leave.use-case";
import { ApproveTimeOffUseCase } from "./application/use-cases/approve-time-off.use-case";
import { RejectTimeOffUseCase } from "./application/use-cases/reject-time-off.use-case";
import { TimeTrackingController } from "./interfaces/timetracking.controller";
import { TimeOffController } from "./interfaces/time-off.controller";

const timeTrackingRepo = new PrismaTimeTrackingRepository();
const timeOffRepo = new PrismaTimeOffRepository();
const auditService = new AuditService(new PrismaAuditLogRepository());

export const timeTrackingController = new TimeTrackingController(
  new ClockInUseCase(timeTrackingRepo, employeeRepo, auditService),
  new ClockOutUseCase(timeTrackingRepo, employeeRepo, auditService),
  new ListTimeEntriesUseCase(timeTrackingRepo),
  employeeRepo,
  timeTrackingRepo
);

export const timeOffController = new TimeOffController(
  timeOffRepo,
  new RequestVacationUseCase(timeOffRepo, employeeRepo, auditService),
  new RequestLeavePermissionUseCase(timeOffRepo, employeeRepo, auditService),
  new RegisterAbsenceUseCase(timeOffRepo, employeeRepo, auditService),
  new SubmitSickLeaveUseCase(timeOffRepo, employeeRepo, auditService),
  new ApproveTimeOffUseCase(timeOffRepo, auditService),
  new RejectTimeOffUseCase(timeOffRepo, auditService)
);

export { timeTrackingRepo, timeOffRepo };
