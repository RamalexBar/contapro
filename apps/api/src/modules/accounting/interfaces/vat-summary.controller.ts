import type { NextFunction, Request, Response } from "express";
import { endOfDayInBogota, startOfDayInBogota } from "@erp/shared-utils";
import { ValidationError } from "../../../shared/errors/app-error";
import type { GetVatSummaryUseCase } from "../application/use-cases/get-vat-summary.use-case";

const DAY = /^\d{4}-\d{2}-\d{2}$/;

/** Resumen de IVA (formulario 300): GET /reports/vat-summary?from=YYYY-MM-DD&to=YYYY-MM-DD[&branchId=] */
export class VatSummaryController {
  constructor(private readonly useCase: GetVatSummaryUseCase) {}

  get = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { from, to, branchId } = req.query;
      if (typeof from !== "string" || typeof to !== "string" || !DAY.test(from) || !DAY.test(to)) {
        throw new ValidationError("Indica el periodo: from y to con formato AAAA-MM-DD");
      }
      if (from > to) throw new ValidationError("La fecha inicial no puede ser posterior a la final");
      res.json(
        await this.useCase.execute(startOfDayInBogota(from), endOfDayInBogota(to), typeof branchId === "string" && branchId ? branchId : undefined)
      );
    } catch (err) {
      next(err);
    }
  };
}
