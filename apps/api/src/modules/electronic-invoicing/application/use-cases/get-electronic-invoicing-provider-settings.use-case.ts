import { getTenantContext } from "../../../../shared/context/request-context";
import type { ICompanyReader } from "../../domain/company-reader.repository";

export interface ElectronicInvoicingProviderSettings {
  provider: "DIRECT" | "MATIAS" | "FACTUS";
  /** Nunca la credencial en si -- solo si hay una cargada, para que la UI sepa si debe pedirla de nuevo. */
  hasMatiasToken: boolean;
  hasFactusCredentials: boolean;
}

export class GetElectronicInvoicingProviderSettingsUseCase {
  constructor(private readonly companyReader: ICompanyReader) {}

  async execute(): Promise<ElectronicInvoicingProviderSettings> {
    const company = await this.companyReader.findByIdOrThrow(getTenantContext().companyId);
    return {
      provider: company.electronicInvoicingProvider,
      hasMatiasToken: Boolean(company.matiasApiTokenEncrypted),
      hasFactusCredentials: Boolean(company.factusCredentialsEncrypted),
    };
  }
}
