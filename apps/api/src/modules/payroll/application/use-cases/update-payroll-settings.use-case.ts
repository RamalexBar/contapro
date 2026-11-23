import type { AuditService } from "../../../audit/application/audit.service";
import type { ICompanyReader } from "../../domain/company-reader.repository";

export interface PayrollSettings {
  /** Exoneracion de aportes del art. 114-1 E.T. (ver PayrollCompanyOptions en payroll-calculator.ts). */
  exemptArt1141: boolean;
}

/** Configuracion de nomina de la empresa (Nomina -> Configuracion). Queda en la auditoria porque
 * cambia cuanto se paga de aportes. */
export class UpdatePayrollSettingsUseCase {
  constructor(private readonly companyReader: ICompanyReader, private readonly audit: AuditService) {}

  async get(companyId: string): Promise<PayrollSettings> {
    const company = await this.companyReader.findByIdOrThrow(companyId);
    return { exemptArt1141: company.payrollExemptArt1141 };
  }

  async execute(companyId: string, input: PayrollSettings): Promise<PayrollSettings> {
    const before = await this.companyReader.findByIdOrThrow(companyId);
    const company = await this.companyReader.setPayrollExemptArt1141(companyId, input.exemptArt1141);
    if (before.payrollExemptArt1141 !== company.payrollExemptArt1141) {
      await this.audit.record({
        action: "PAYROLL_SETTINGS_UPDATED",
        entityType: "Company",
        entityId: companyId,
        description: company.payrollExemptArt1141
          ? "Nomina: se activo la exoneracion de aportes del art. 114-1 E.T."
          : "Nomina: se desactivo la exoneracion de aportes del art. 114-1 E.T.",
        metadata: { exemptArt1141: company.payrollExemptArt1141 },
      });
    }
    return { exemptArt1141: company.payrollExemptArt1141 };
  }
}
