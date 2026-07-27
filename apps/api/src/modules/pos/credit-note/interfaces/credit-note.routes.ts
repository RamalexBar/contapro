import { Router } from "express";
import { tenantContextMiddleware } from "../../../../shared/middlewares/tenant-context.middleware";
import { requirePermission } from "../../../../shared/middlewares/require-permission.middleware";
import { creditNoteController } from "../credit-note.container";

export const creditNoteRouter = Router();
creditNoteRouter.use(tenantContextMiddleware);

creditNoteRouter.get("/credit-notes", requirePermission("sale.read"), creditNoteController.list);
creditNoteRouter.post("/credit-notes", requirePermission("creditnote.create"), creditNoteController.create);
