import { Router } from "express";
import { tenantContextMiddleware } from "../../../shared/middlewares/tenant-context.middleware";
import { requirePermission } from "../../../shared/middlewares/require-permission.middleware";
import { exogenaController } from "../exogena.container";

export const exogenaRouter = Router();
exogenaRouter.use(tenantContextMiddleware);

// Reusa accounting.read (mismo permiso que Balance General/Estado de Resultados/Libro Mayor) --
// es un reporte contable mas, no se justifica un permiso dedicado.
exogenaRouter.get("/reports/exogena/1001", requirePermission("accounting.read"), exogenaController.getFormat1001);
exogenaRouter.get("/reports/exogena/1001/download", requirePermission("accounting.read"), exogenaController.downloadFormat1001);
exogenaRouter.get("/reports/exogena/1003", requirePermission("accounting.read"), exogenaController.getFormat1003);
exogenaRouter.get("/reports/exogena/1003/download", requirePermission("accounting.read"), exogenaController.downloadFormat1003);
exogenaRouter.get("/reports/exogena/1007", requirePermission("accounting.read"), exogenaController.getFormat1007);
exogenaRouter.get("/reports/exogena/1007/download", requirePermission("accounting.read"), exogenaController.downloadFormat1007);
exogenaRouter.get("/reports/exogena/1008", requirePermission("accounting.read"), exogenaController.getFormat1008);
exogenaRouter.get("/reports/exogena/1008/download", requirePermission("accounting.read"), exogenaController.downloadFormat1008);
exogenaRouter.get("/reports/exogena/1009", requirePermission("accounting.read"), exogenaController.getFormat1009);
exogenaRouter.get("/reports/exogena/1009/download", requirePermission("accounting.read"), exogenaController.downloadFormat1009);
