import type { IThirdPartyInvoicingClient } from "../domain/third-party-invoicing-client";

/** Subconjunto de CompanyRecord que este resolver necesita -- evita un import circular de domain
 * en el caso de uso que solo quiere resolver, no leer toda la empresa. */
export interface ThirdPartyProviderCompany {
  electronicInvoicingProvider: "DIRECT" | "MATIAS" | "FACTUS";
  matiasApiTokenEncrypted: string | null;
  factusCredentialsEncrypted: string | null;
}

export interface ResolvedThirdPartyProvider {
  providerName: "MATIAS" | "FACTUS";
  client: IThirdPartyInvoicingClient;
  encryptedCredential: string | null;
}

/**
 * Punto unico donde se decide, a partir de `Company.electronicInvoicingProvider`, que cliente de
 * proveedor tecnologico usar y de que columna sacar la credencial cifrada -- usado por
 * GenerateElectronicInvoiceUseCase y ResubmitElectronicInvoiceUseCase para no duplicar este
 * if/else en los dos lugares. Devuelve null si el proveedor es DIRECT (no hay proveedor tercero
 * que resolver).
 */
export function resolveThirdPartyProvider(
  company: ThirdPartyProviderCompany,
  matiasClient: IThirdPartyInvoicingClient,
  factusClient: IThirdPartyInvoicingClient
): ResolvedThirdPartyProvider | null {
  if (company.electronicInvoicingProvider === "MATIAS") {
    return { providerName: "MATIAS", client: matiasClient, encryptedCredential: company.matiasApiTokenEncrypted };
  }
  if (company.electronicInvoicingProvider === "FACTUS") {
    return { providerName: "FACTUS", client: factusClient, encryptedCredential: company.factusCredentialsEncrypted };
  }
  return null;
}
