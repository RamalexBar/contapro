import type { NextFunction, Request, Response } from "express";
import { z } from "zod";
import { endOfDayInBogota, startOfDayInBogota } from "@erp/shared-utils";
import type { GetProfitabilityReportUseCase } from "../application/use-cases/get-profitability-report.use-case";

const DATE = /^\d{4}-\d{2}-\d{2}$/;
const querySchema = z.object({
  from: z.string().regex(DATE, "from debe ser una fecha AAAA-MM-DD"),
  to: z.string().regex(DATE, "to debe ser una fecha AAAA-MM-DD"),
  groupBy: z.enum(["product", "category", "customer"]).default("product"),
  branchId: z.string().uuid().optional(),
});

export class ProfitabilityController {
  constructor(private readonly getReport: GetProfitabilityReportUseCase) {}

  get = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const query = querySchema.parse(req.query);
      const from = startOfDayInBogota(query.from);
      const to = endOfDayInBogota(query.to);
      const report = await this.getReport.execute({ from, to, branchId: query.branchId, groupBy: query.groupBy });
      res.json({ from: from.toISOString(), to: to.toISOString(), ...report });
    } catch (err) {
      next(err);
    }
  };
}
