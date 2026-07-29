import { Router } from "express";
import { tenantContextMiddleware } from "../../../shared/middlewares/tenant-context.middleware";
import { requirePermission } from "../../../shared/middlewares/require-permission.middleware";
import { timeTrackingController, timeOffController } from "../timetracking.container";

export const timetrackingRouter = Router();
timetrackingRouter.use(tenantContextMiddleware);

timetrackingRouter.get("/time-entries", requirePermission("timetracking.read"), timeTrackingController.list);
timetrackingRouter.get(
  "/time-entries/my-open",
  requirePermission("timetracking.clock"),
  timeTrackingController.myOpenEntry
);
timetrackingRouter.post("/time-entries/clock-in", requirePermission("timetracking.clock"), timeTrackingController.clockIn);
timetrackingRouter.post("/time-entries/:id/clock-out", requirePermission("timetracking.clock"), timeTrackingController.clockOut);

// ---- Vacaciones ----
timetrackingRouter.get("/vacations", requirePermission("timeoff.read"), timeOffController.listVacations);
timetrackingRouter.post("/vacations", requirePermission("timeoff.request"), timeOffController.requestVacation);
timetrackingRouter.post("/vacations/:id/approve", requirePermission("timeoff.manage"), timeOffController.approveVacation);
timetrackingRouter.post("/vacations/:id/reject", requirePermission("timeoff.manage"), timeOffController.rejectVacation);

// ---- Permisos ----
timetrackingRouter.get("/leave-permissions", requirePermission("timeoff.read"), timeOffController.listLeavePermissions);
timetrackingRouter.post(
  "/leave-permissions",
  requirePermission("timeoff.request"),
  timeOffController.requestLeavePermission
);
timetrackingRouter.post(
  "/leave-permissions/:id/approve",
  requirePermission("timeoff.manage"),
  timeOffController.approveLeavePermission
);
timetrackingRouter.post(
  "/leave-permissions/:id/reject",
  requirePermission("timeoff.manage"),
  timeOffController.rejectLeavePermission
);

// ---- Ausencias (siempre registradas por un manager, sin flujo de aprobacion) ----
timetrackingRouter.get("/absences", requirePermission("timeoff.read"), timeOffController.listAbsences);
timetrackingRouter.post("/absences", requirePermission("timeoff.manage"), timeOffController.registerAbsence);

// ---- Incapacidades ----
timetrackingRouter.get("/sick-leaves", requirePermission("timeoff.read"), timeOffController.listSickLeaves);
timetrackingRouter.post("/sick-leaves", requirePermission("timeoff.request"), timeOffController.submitSickLeave);
timetrackingRouter.post(
  "/sick-leaves/:id/approve",
  requirePermission("timeoff.manage"),
  timeOffController.approveSickLeave
);
timetrackingRouter.post(
  "/sick-leaves/:id/reject",
  requirePermission("timeoff.manage"),
  timeOffController.rejectSickLeave
);
