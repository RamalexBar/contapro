import { PrismaPayrollParameterRepository } from "../../payroll/infrastructure/prisma-payroll-parameter.repository";
import type { IUvtProvider } from "../application/use-cases/create-purchase.use-case";

/**
 * El UVT del año vive en los parametros legales (PayrollParameter, tabla global que mantiene el panel
 * de plataforma, Resolucion DIAN de cada año). Sin fila para el año: null (no se mide la base minima).
 */
export class PayrollParameterUvtProvider implements IUvtProvider {
  private readonly repo = new PrismaPayrollParameterRepository();

  async uvtForYear(year: number): Promise<number | null> {
    try {
      return (await this.repo.findByYearOrThrow(year)).uvt;
    } catch {
      return null;
    }
  }
}
