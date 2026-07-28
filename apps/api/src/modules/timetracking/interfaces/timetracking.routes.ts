import { Router } from "express";
import { tenantContextMiddleware } from "../../../shared/middlewares/tenant-context.middleware";
import { requirePermission } from "../../../shared/middlewares/require-permission.middleware";
import { notImplemented } from "../../../shared/middlewares/not-implemented.middleware";
import { timeTrackingController } from "../timetracking.container";

export const timetrackingRouter = Router();
timetrackingRouter.use(tenantContextMiddleware);

timetrackingRouter.get("/time-entries", requirePermission("timetracking.read"), timeTrackingController.list);
timetrackingRouter.post("/time-entries/clock-in", requirePermission("timetracking.clock"), timeTrackingController.clockIn);
timetrackingRouter.post("/time-entries/:id/clock-out", requirePermission("timetracking.clock"), timeTrackingController.clockOut);

// Vacaciones/permisos/incapacidades/ausencias: aun no implementado, ver README.md del modulo.
const stub = notImplemented("timetracking");
timetrackingRouter.all("/vacations", stub);
timetrackingRouter.all("/leave-permissions", stub);
timetrackingRouter.all("/absences", stub);
timetrackingRouter.all("/sick-leaves", stub);
