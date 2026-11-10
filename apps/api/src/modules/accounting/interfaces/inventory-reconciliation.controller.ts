import type { NextFunction, Request, Response } from "express";
import type { RegularizeInventoryAccountUseCase } from "../application/use-cases/regularize-inventory-account.use-case";

/** Conciliacion de la cuenta 1435 contra el inventario valorizado real. GET consulta; POST registra la regularizacion. */
export class InventoryReconciliationController {
  constructor(private readonly useCase: RegularizeInventoryAccountUseCase) {}

  get = async (_req: Request, res: Response, next: NextFunction) => {
    try {
      res.json(await this.useCase.execute({ apply: false }));
    } catch (err) {
      next(err);
    }
  };

  regularize = async (_req: Request, res: Response, next: NextFunction) => {
    try {
      res.status(201).json(await this.useCase.execute({ apply: true }));
    } catch (err) {
      next(err);
    }
  };
}
