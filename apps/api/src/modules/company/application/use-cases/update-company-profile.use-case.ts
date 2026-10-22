import { ConflictError, ValidationError } from "../../../../shared/errors/app-error";
import { getTenantContext } from "../../../../shared/context/request-context";
import type { AuditService } from "../../../audit/application/audit.service";
import type { ICompanyProfileRepository, UpdateCompanyProfileData } from "../../domain/company-profile.repository";

export class UpdateCompanyProfileUseCase {
  constructor(
    private readonly repo: ICompanyProfileRepository,
    private readonly audit: AuditService
  ) {}

  async execute(input: UpdateCompanyProfileData) {
    const companyId = getTenantContext().companyId;

    // El NIT se puede corregir (ej. se registro con un error de digitacion) mientras la empresa no
    // haya emitido facturas electronicas: las ya emitidas llevan el NIT anterior en su XML firmado.
    if (input.nit !== undefined) {
      const current = await this.repo.findByIdOrThrow(companyId);
      if (input.nit !== current.nit) {
        if (await this.repo.isNitTakenByAnotherCompany(input.nit, companyId)) {
          throw new ConflictError("Ya existe otra empresa registrada con ese NIT o cédula");
        }
        if ((await this.repo.countElectronicInvoices(companyId)) > 0) {
          throw new ValidationError(
            "No se puede cambiar el NIT porque la empresa ya emitió facturas electrónicas con el NIT actual. Escríbele al equipo de ContaPro."
          );
        }
      }
    }

    const company = await this.repo.update(companyId, input);

    await this.audit.record({
      action: "COMPANY_PROFILE_UPDATED",
      entityType: "Company",
      entityId: companyId,
      description: "Datos fiscales de la empresa actualizados",
    });

    return company;
  }
}
