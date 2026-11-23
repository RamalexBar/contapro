import type { NextFunction, Request, Response } from "express";
import type { SettleBenefitsUseCase } from "../application/use-cases/settle-benefits.use-case";
import type { BenefitSettlementType, IBenefitSettlementRepository } from "../domain/benefit-settlement.repository";
import type { IEmployeeRepository } from "../../employees/domain/employee.repository";
import type { ICompanyReader } from "../domain/company-reader.repository";
import { renderBenefitSettlementPdf } from "../infrastructure/pdfkit-benefit-settlement-renderer";
import { getTenantContext } from "../../../shared/context/request-context";
import { settleBenefitsSchema } from "./payroll.validators";

const TYPES = new Set(["SERVICE_BONUS", "SEVERANCE", "TERMINATION"]);

/** Prima de servicios, consolidacion de cesantias y liquidacion del contrato (Nomina -> Prestaciones). */
export class BenefitSettlementController {
  constructor(
    private readonly settleUseCase: SettleBenefitsUseCase,
    private readonly repo: IBenefitSettlementRepository,
    private readonly employeeRepo: IEmployeeRepository,
    private readonly companyReader: ICompanyReader
  ) {}

  preview = async (req: Request, res: Response, next: NextFunction) => {
    try {
      res.json(await this.settleUseCase.preview(settleBenefitsSchema.parse(req.body)));
    } catch (err) {
      next(err);
    }
  };

  settle = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const result = await this.settleUseCase.execute(settleBenefitsSchema.parse(req.body));
      res.status(201).json({ data: result.records });
    } catch (err) {
      next(err);
    }
  };

  list = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const type = typeof req.query.type === "string" && TYPES.has(req.query.type) ? (req.query.type as BenefitSettlementType) : undefined;
      const year = typeof req.query.year === "string" ? Number(req.query.year) : undefined;
      res.json({ data: await this.repo.list({ type, year: Number.isFinite(year) ? year : undefined }) });
    } catch (err) {
      next(err);
    }
  };

  pdf = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const record = await this.repo.findByIdOrThrow(req.params.id);
      const [employee, company] = await Promise.all([
        this.employeeRepo.findByIdOrThrow(record.employeeId),
        this.companyReader.findByIdOrThrow(getTenantContext().companyId),
      ]);
      res.type("application/pdf").send(await renderBenefitSettlementPdf(record, company, employee));
    } catch (err) {
      next(err);
    }
  };
}
