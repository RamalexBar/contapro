import type { NextFunction, Request, Response } from "express";
import { ZodError } from "zod";
import { AppError } from "../errors/app-error";
import { describeError, operationalAlerts } from "../alerts/operational-alerts";

export function errorHandlerMiddleware(err: unknown, req: Request, res: Response, _next: NextFunction) {
  if (err instanceof ZodError) {
    return res.status(422).json({
      error: "VALIDATION_ERROR",
      message: "Datos de entrada invalidos",
      details: err.flatten(),
    });
  }

  if (err instanceof AppError) {
    return res.status(err.statusCode).json({
      error: err.code,
      message: err.message,
      details: err.details,
    });
  }

  // Un error que no se esperaba: se avisa al equipo (agrupado por ruta y mensaje, no en cada repeticion)
  const route = `${req.method} ${req.baseUrl}${req.route?.path ?? req.path}`;
  operationalAlerts.send(`500:${route}:${err instanceof Error ? err.message.slice(0, 80) : ""}`, `Error interno en ${route}`, describeError(err));
  return res.status(500).json({ error: "INTERNAL_ERROR", message: "Error interno del servidor" });
}
