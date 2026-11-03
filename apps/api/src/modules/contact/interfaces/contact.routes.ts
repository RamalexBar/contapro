import { Router } from "express";
import rateLimit from "express-rate-limit";
import { requirePlatformAdmin } from "../../../shared/middlewares/require-platform-admin.middleware";
import { contactController } from "../contact.container";

/** Para frenar abusos del formulario publico: 5 mensajes por hora desde la misma conexion. */
const contactRateLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  limit: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "TOO_MANY_REQUESTS", message: "Ya recibimos varios mensajes desde esta conexión. Escríbanos por WhatsApp o intente en una hora." },
});

// Sin tenantContextMiddleware: el formulario es publico (la persona todavia no tiene cuenta) y el listado es del
// panel de plataforma. Va montado antes de los routers con sesion (ver app.ts).
export const contactRouter = Router();

contactRouter.post("/contact-messages", contactRateLimiter, contactController.submit);
contactRouter.get("/admin/contact-messages", requirePlatformAdmin, contactController.list);
contactRouter.patch("/admin/contact-messages/:id/handled", requirePlatformAdmin, contactController.setHandled);
