import { Router } from "express";
import { tenantContextMiddleware } from "../../../shared/middlewares/tenant-context.middleware";
import { notImplemented } from "../../../shared/middlewares/not-implemented.middleware";

export const timetrackingRouter = Router();
timetrackingRouter.use(tenantContextMiddleware);

const stub = notImplemented("timetracking");
timetrackingRouter.all("/time-entries", stub);
timetrackingRouter.all("/vacations", stub);
timetrackingRouter.all("/leave-permissions", stub);
timetrackingRouter.all("/absences", stub);
timetrackingRouter.all("/sick-leaves", stub);
