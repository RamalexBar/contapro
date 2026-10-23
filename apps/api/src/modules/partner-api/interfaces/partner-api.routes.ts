import { Router } from "express";
import { requirePartnerKey } from "./require-partner-key.middleware";
import { partnerApiController } from "../partner-api.container";

// Sin tenantContextMiddleware: la llamada viene del servidor del aliado, no de un usuario de empresa
// (mismo caso que saasAdminRouter). La protege la llave secreta del aliado.
export const partnerApiRouter = Router();

partnerApiRouter.post("/partner/v1/cajapro/accounts", requirePartnerKey("CAJAPRO"), partnerApiController.provisionCajaproAccount);
