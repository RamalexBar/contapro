import type { Request, Response } from "express";

/**
 * Handler generico para modulos "stub" (schema Prisma completo, sin logica de negocio
 * todavia). Ver el README.md de cada modulo para el alcance planeado.
 */
export function notImplemented(moduleName: string) {
  return (_req: Request, res: Response) => {
    res.status(501).json({
      error: "NOT_IMPLEMENTED",
      message: `El modulo '${moduleName}' esta modelado en la base de datos pero su logica de negocio aun no esta implementada. Ver apps/api/src/modules/${moduleName}/README.md`,
    });
  };
}
