import { Router, type NextFunction, type Request, type Response } from "express";
import { z } from "zod";
import { createPayrollParameterSchema } from "@erp/shared-types";
import { requirePlatformAdmin } from "../../../shared/middlewares/require-platform-admin.middleware";
import { createPayrollParameterUseCase, listPayrollParametersUseCase } from "../payroll.container";

/**
 * Parametros legales de nomina (tabla GLOBAL, ver CreatePayrollParameterUseCase): solo el panel de
 * plataforma los publica o corrige. Se registra en app.ts ANTES de payrollRouter, porque ese router
 * aplica tenantContextMiddleware a todo lo que pasa por el.
 */
export const payrollPlatformRouter = Router();

const handle =
  (fn: (req: Request, res: Response) => Promise<void>) => (req: Request, res: Response, next: NextFunction) =>
    fn(req, res).catch(next);

payrollPlatformRouter.get(
  "/admin/payroll-parameters",
  requirePlatformAdmin,
  handle(async (_req, res) => {
    res.json({ data: await listPayrollParametersUseCase.execute() });
  })
);

payrollPlatformRouter.post(
  "/admin/payroll-parameters",
  requirePlatformAdmin,
  handle(async (req, res) => {
    res.status(201).json(await createPayrollParameterUseCase.execute(createPayrollParameterSchema.parse(req.body)));
  })
);

payrollPlatformRouter.put(
  "/admin/payroll-parameters/:year",
  requirePlatformAdmin,
  handle(async (req, res) => {
    const year = z.coerce.number().int().min(2000).max(2100).parse(req.params.year);
    res.json(await createPayrollParameterUseCase.update(year, createPayrollParameterSchema.parse(req.body)));
  })
);
