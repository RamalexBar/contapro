import type { NextFunction, Request, Response } from "express";
import { ZodError } from "zod";
import { AppError } from "../errors/app-error";

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

  console.error("Unhandled error:", err);
  return res.status(500).json({ error: "INTERNAL_ERROR", message: "Error interno del servidor" });
}
