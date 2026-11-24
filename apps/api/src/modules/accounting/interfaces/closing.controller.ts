import type { NextFunction, Request, Response } from "express";
import { z } from "zod";
import type { AnnualClosingUseCase } from "../application/use-cases/annual-closing.use-case";
import type { WithholdingReturnUseCase } from "../application/use-cases/withholding-return.use-case";

const yearSchema = z.coerce.number().int().min(2000).max(2100);
const monthSchema = z.coerce.number().int().min(1).max(12);
const paymentSchema = z.object({
  year: yearSchema,
  month: monthSchema,
  paidFrom: z.enum(["BANK", "CASH"]),
  paymentDate: z.coerce.date(),
});

/** Cierre contable anual y formulario 350 (retenciones del mes y su pago). */
export class ClosingController {
  constructor(
    private readonly annualClosing: AnnualClosingUseCase,
    private readonly withholdingReturn: WithholdingReturnUseCase
  ) {}

  previewAnnualClosing = async (req: Request, res: Response, next: NextFunction) => {
    try {
      res.json(await this.annualClosing.preview(yearSchema.parse(req.query.year)));
    } catch (err) {
      next(err);
    }
  };

  postAnnualClosing = async (req: Request, res: Response, next: NextFunction) => {
    try {
      res.status(201).json(await this.annualClosing.execute(yearSchema.parse(req.body?.year)));
    } catch (err) {
      next(err);
    }
  };

  getWithholdingReturn = async (req: Request, res: Response, next: NextFunction) => {
    try {
      res.json(await this.withholdingReturn.report(yearSchema.parse(req.query.year), monthSchema.parse(req.query.month)));
    } catch (err) {
      next(err);
    }
  };

  payWithholdingReturn = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const body = paymentSchema.parse(req.body);
      res.status(201).json(await this.withholdingReturn.registerPayment(body.year, body.month, body.paidFrom, body.paymentDate));
    } catch (err) {
      next(err);
    }
  };
}
