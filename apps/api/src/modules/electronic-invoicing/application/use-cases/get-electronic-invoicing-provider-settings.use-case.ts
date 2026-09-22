import { getTenantContext } from "../../../../shared/context/request-context";
import type { ICompanyReader } from "../../domain/company-reader.repository";

export interface ElectronicInvoicingProviderSettings {
  provider: "DIRECT" | "FACTUS";
  /** Nunca la credencial en si -- solo si hay una cargada (con su rango de numeracion ya
   * provisionado), para que la UI sepa si debe pedirla de nuevo. */
  hasFactusCredentials: boolean;
}

export class GetElectronicInvoicingProviderSettingsUseCase {
  constructor(private readonly companyReader: ICompanyReader) {}

  async execute(): Promise<ElectronicInvoicingProviderSettings> {
    const company = await this.companyReader.findByIdOrThrow(getTenantContext().companyId);
    return {
      provider: company.electronicInvoicingProvider,
      hasFactusCredentials: Boolean(company.factusCredentialsEncrypted),
    };
  }
}
