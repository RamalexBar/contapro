import type { NextFunction, Request, Response } from "express";
import type { GetDashboardMetricsUseCase } from "../application/use-cases/get-dashboard-metrics.use-case";

export class DashboardController {
  constructor(private readonly getMetricsUseCase: GetDashboardMetricsUseCase) {}

  metrics = async (_req: Request, res: Response, next: NextFunction) => {
    try {
      res.json(await this.getMetricsUseCase.execute());
    } catch (err) {
      next(err);
    }
  };
}
