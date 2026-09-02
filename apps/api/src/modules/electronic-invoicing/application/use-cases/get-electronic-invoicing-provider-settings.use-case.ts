import { getTenantContext } from "../../../../shared/context/request-context";
import type { ICompanyReader } from "../../domain/company-reader.repository";

export interface ElectronicInvoicingProviderSettings {
  provider: "DIRECT" | "MATIAS";
  /** Nunca el token en si -- solo si hay uno cargado, para que la UI sepa si debe pedirlo de nuevo. */
  hasMatiasToken: boolean;
}

export class GetElectronicInvoicingProviderSettingsUseCase {
  constructor(private readonly companyReader: ICompanyReader) {}

  async execute(): Promise<ElectronicInvoicingProviderSettings> {
    const company = await this.companyReader.findByIdOrThrow(getTenantContext().companyId);
    return {
      provider: company.electronicInvoicingProvider,
      hasMatiasToken: Boolean(company.matiasApiTokenEncrypted),
    };
  }
}
