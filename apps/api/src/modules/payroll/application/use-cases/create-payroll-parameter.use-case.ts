import type { CreatePayrollParameterInput } from "@erp/shared-types";
import type { IPayrollParameterRepository, PayrollParameterRecord } from "../../domain/payroll-parameter.repository";

/**
 * Crea o corrige los parametros legales de un año. PayrollParameter es una tabla GLOBAL (la misma
 * legislacion para todas las empresas), por eso solo se expone en el panel de plataforma
 * (payroll-platform.routes.ts), nunca a una empresa: antes cualquier administrador o contador de
 * cualquier empresa podia publicar los parametros de un año para todas. Sin AuditLog porque esa
 * tabla es por empresa y esto no pertenece a ninguna.
 */
export class CreatePayrollParameterUseCase {
  constructor(private readonly repo: IPayrollParameterRepository) {}

  async execute(input: CreatePayrollParameterInput): Promise<PayrollParameterRecord> {
    return this.repo.create({ ...input, effectiveTo: input.effectiveTo ?? null });
  }

  async update(year: number, input: CreatePayrollParameterInput): Promise<PayrollParameterRecord> {
    return this.repo.updateByYear(year, { ...input, year, effectiveTo: input.effectiveTo ?? null });
  }
}
