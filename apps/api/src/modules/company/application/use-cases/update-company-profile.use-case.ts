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
