import { NotFoundError } from "../../../../shared/errors/app-error";
import type { ElectronicPayrollWithXml, IElectronicPayrollRepository } from "../../domain/electronic-payroll.repository";

export class GetElectronicPayrollUseCase {
  constructor(private readonly repo: IElectronicPayrollRepository) {}

  async execute(payrollDetailId: string): Promise<ElectronicPayrollWithXml> {
    const doc = await this.repo.findByPayrollDetailId(payrollDetailId);
    if (!doc) throw new NotFoundError("ElectronicPayroll", payrollDetailId);
    return doc;
  }
}
