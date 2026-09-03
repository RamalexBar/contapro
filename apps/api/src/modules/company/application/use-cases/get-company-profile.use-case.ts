import { getTenantContext } from "../../../../shared/context/request-context";
import type { CompanyProfileRecord, ICompanyProfileRepository } from "../../domain/company-profile.repository";
import { isCompanyProfileComplete, type CompanyProfileCompleteness } from "../is-company-profile-complete";

export interface CompanyProfileWithCompleteness extends CompanyProfileRecord, CompanyProfileCompleteness {}

export class GetCompanyProfileUseCase {
  constructor(private readonly repo: ICompanyProfileRepository) {}

  async execute(): Promise<CompanyProfileWithCompleteness> {
    const company = await this.repo.findByIdOrThrow(getTenantContext().companyId);
    return { ...company, ...isCompanyProfileComplete(company) };
  }
}
