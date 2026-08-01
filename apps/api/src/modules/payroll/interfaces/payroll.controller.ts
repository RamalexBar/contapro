import type { NextFunction, Request, Response } from "express";
import type { CreatePayrollParameterUseCase } from "../application/use-cases/create-payroll-parameter.use-case";
import type { ListPayrollParametersUseCase } from "../application/use-cases/list-payroll-parameters.use-case";
import type { CreatePayrollUseCase } from "../application/use-cases/create-payroll.use-case";
import type { ListPayrollsUseCase } from "../application/use-cases/list-payrolls.use-case";
import type { CalculatePayrollUseCase } from "../application/use-cases/calculate-payroll.use-case";
import type { ApprovePayrollUseCase } from "../application/use-cases/approve-payroll.use-case";
import type { PayPayrollUseCase } from "../application/use-cases/pay-payroll.use-case";
import type { CreatePayrollDeductionUseCase } from "../application/use-cases/create-payroll-deduction.use-case";
import type { ListPayrollDeductionsUseCase } from "../application/use-cases/list-payroll-deductions.use-case";
import type { CancelPayrollDeductionUseCase } from "../application/use-cases/cancel-payroll-deduction.use-case";
import type { IPayrollRepository } from "../domain/payroll.repository";
import type { PayrollDeductionStatus } from "../domain/payroll-deduction.repository";
import type { IEmployeeRepository } from "../../employees/domain/employee.repository";
import type { ICompanyReader } from "../domain/company-reader.repository";
import { mapToPayslipPdfData } from "../application/payslip-data-mapper";
import { renderPayslipPdf } from "../infrastructure/pdfkit-payslip-renderer";
import { createPayrollDeductionSchema, createPayrollParameterSchema, createPayrollSchema } from "./payroll.validators";
import { getTenantContext } from "../../../shared/context/request-context";

export class PayrollController {
  constructor(
    private readonly payrollRepo: IPayrollRepository,
    private readonly employeeRepo: IEmployeeRepository,
    private readonly companyReader: ICompanyReader,
    private readonly createParameterUseCase: CreatePayrollParameterUseCase,
    private readonly listParametersUseCase: ListPayrollParametersUseCase,
    private readonly createPayrollUseCase: CreatePayrollUseCase,
    private readonly listPayrollsUseCase: ListPayrollsUseCase,
    private readonly calculatePayrollUseCase: CalculatePayrollUseCase,
    private readonly approvePayrollUseCase: ApprovePayrollUseCase,
    private readonly payPayrollUseCase: PayPayrollUseCase,
    private readonly createDeductionUseCase: CreatePayrollDeductionUseCase,
    private readonly listDeductionsUseCase: ListPayrollDeductionsUseCase,
    private readonly cancelDeductionUseCase: CancelPayrollDeductionUseCase
  ) {}

  createParameter = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const body = createPayrollParameterSchema.parse(req.body);
      res.status(201).json(await this.createParameterUseCase.execute(body));
    } catch (err) {
      next(err);
    }
  };

  listParameters = async (_req: Request, res: Response, next: NextFunction) => {
    try {
      res.json({ data: await this.listParametersUseCase.execute() });
    } catch (err) {
      next(err);
    }
  };

  create = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const body = createPayrollSchema.parse(req.body);
      res.status(201).json(await this.createPayrollUseCase.execute(body));
    } catch (err) {
      next(err);
    }
  };

  list = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const year = typeof req.query.year === "string" ? Number(req.query.year) : undefined;
      const branchId = typeof req.query.branchId === "string" ? req.query.branchId : undefined;
      res.json({ data: await this.listPayrollsUseCase.execute({ year, branchId }) });
    } catch (err) {
      next(err);
    }
  };

  getById = async (req: Request, res: Response, next: NextFunction) => {
    try {
      res.json(await this.payrollRepo.findWithDetailsOrThrow(req.params.id));
    } catch (err) {
      next(err);
    }
  };

  getPayslip = async (req: Request, res: Response, next: NextFunction) => {
    try {
      res.json(await this.payrollRepo.findPayslipByIdOrThrow(req.params.id));
    } catch (err) {
      next(err);
    }
  };

  getPayslipPdf = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const payslip = await this.payrollRepo.findPayslipByIdOrThrow(req.params.id);
      const employeeId = (payslip.summaryJson as { employeeId: string }).employeeId;
      const [employee, company] = await Promise.all([
        this.employeeRepo.findByIdOrThrow(employeeId),
        this.companyReader.findByIdOrThrow(getTenantContext().companyId),
      ]);
      const pdf = await renderPayslipPdf(mapToPayslipPdfData(payslip, employee, company));
      res.type("application/pdf").send(pdf);
    } catch (err) {
      next(err);
    }
  };

  calculate = async (req: Request, res: Response, next: NextFunction) => {
    try {
      res.json(await this.calculatePayrollUseCase.execute(req.params.id));
    } catch (err) {
      next(err);
    }
  };

  approve = async (req: Request, res: Response, next: NextFunction) => {
    try {
      res.json(await this.approvePayrollUseCase.execute(req.params.id));
    } catch (err) {
      next(err);
    }
  };

  pay = async (req: Request, res: Response, next: NextFunction) => {
    try {
      res.json(await this.payPayrollUseCase.execute(req.params.id));
    } catch (err) {
      next(err);
    }
  };

  createDeduction = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const body = createPayrollDeductionSchema.parse(req.body);
      res.status(201).json(await this.createDeductionUseCase.execute(body));
    } catch (err) {
      next(err);
    }
  };

  listDeductions = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const employeeId = typeof req.query.employeeId === "string" ? req.query.employeeId : undefined;
      const status = typeof req.query.status === "string" ? (req.query.status as PayrollDeductionStatus) : undefined;
      res.json({ data: await this.listDeductionsUseCase.execute({ employeeId, status }) });
    } catch (err) {
      next(err);
    }
  };

  cancelDeduction = async (req: Request, res: Response, next: NextFunction) => {
    try {
      res.json(await this.cancelDeductionUseCase.execute(req.params.id));
    } catch (err) {
      next(err);
    }
  };
}
