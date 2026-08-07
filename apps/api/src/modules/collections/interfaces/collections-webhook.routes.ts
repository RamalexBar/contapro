import { Router } from "express";
import { collectionsController } from "../collections.container";

// NOTA: este router NO usa tenantContextMiddleware -- Wompi llama esta URL directo, sin JWT.
// Debe montarse en app.ts ANTES que cualquier router tenant-scoped (mismo motivo que
// saasAdminRouter: un router con `.use(tenantContextMiddleware)` sin path intercepta cualquier
// request que le llegue, no solo las suyas).
export const collectionsWebhookRouter = Router();

collectionsWebhookRouter.post("/collections/webhooks/wompi", collectionsController.wompiWebhook);
