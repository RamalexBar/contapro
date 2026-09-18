export interface CompanyRecord {
  id: string;
  nit: string;
  legalName: string;
  name: string;
  /** Ver modules/electronic-invoicing/README.md, seccion "Proveedor tecnologico (MATIAS API /
   * Factus API)". */
  electronicInvoicingProvider: "DIRECT" | "MATIAS" | "FACTUS";
  /** Cifrado (credential-cipher.ts) -- descifrar solo justo antes de llamar al proveedor. */
  matiasApiTokenEncrypted: string | null;
  /** Cifrado (credential-cipher.ts): JSON de {clientId, clientSecret, email, password,
   * numberingRangeId} -- ver factus-invoicing-client.ts. */
  factusCredentialsEncrypted: string | null;
}

/**
 * Lectura minima de Company para este modulo. No existe un ICompanyRepository generico en el
 * codebase (Company solo se toca directamente durante el registro) -- se define aqui, acotado
 * a este modulo, en lugar de crear un modulo "tenant" nuevo solo para esta unica lectura.
 */
export interface ICompanyReader {
  findByIdOrThrow(id: string): Promise<CompanyRecord>;
  /** Ver README, seccion "Proveedor tecnologico (MATIAS API / Factus API)" -- endpoint
   * PUT /electronic-invoicing/provider-settings. Las credenciales ya vienen cifradas (ver
   * shared/crypto/credential-cipher.ts), este metodo no cifra nada por su cuenta. Cada campo de
   * credencial es independiente del proveedor activo -- cambiar de MATIAS a FACTUS y volver no
   * borra la credencial del que se dejo de usar (mismo criterio ya establecido para MATIAS). */
  updateElectronicInvoicingProvider(
    companyId: string,
    provider: "DIRECT" | "MATIAS" | "FACTUS",
    credentials: { matiasApiTokenEncrypted?: string | null; factusCredentialsEncrypted?: string | null }
  ): Promise<void>;
}
