import { Router } from "express";
import { tenantContextMiddleware } from "../../../../shared/middlewares/tenant-context.middleware";
import { requirePermission } from "../../../../shared/middlewares/require-permission.middleware";
import { debitNoteController } from "../debit-note.container";

export const debitNoteRouter = Router();
debitNoteRouter.use(tenantContextMiddleware);

debitNoteRouter.get("/debit-notes", requirePermission("sale.read"), debitNoteController.list);
debitNoteRouter.post("/debit-notes", requirePermission("debitnote.create"), debitNoteController.create);
