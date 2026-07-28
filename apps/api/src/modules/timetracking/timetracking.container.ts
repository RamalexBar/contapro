import { PrismaAuditLogRepository } from "../audit/infrastructure/prisma-audit-log.repository";
import { AuditService } from "../audit/application/audit.service";
import { employeeRepo } from "../employees/employees.container";
import { PrismaTimeTrackingRepository } from "./infrastructure/prisma-timetracking.repository";
import { ClockInUseCase } from "./application/use-cases/clock-in.use-case";
import { ClockOutUseCase } from "./application/use-cases/clock-out.use-case";
import { ListTimeEntriesUseCase } from "./application/use-cases/list-time-entries.use-case";
import { TimeTrackingController } from "./interfaces/timetracking.controller";

const timeTrackingRepo = new PrismaTimeTrackingRepository();
const auditService = new AuditService(new PrismaAuditLogRepository());

export const timeTrackingController = new TimeTrackingController(
  new ClockInUseCase(timeTrackingRepo, employeeRepo, auditService),
  new ClockOutUseCase(timeTrackingRepo, employeeRepo, auditService),
  new ListTimeEntriesUseCase(timeTrackingRepo),
  employeeRepo,
  timeTrackingRepo
);

export { timeTrackingRepo };
