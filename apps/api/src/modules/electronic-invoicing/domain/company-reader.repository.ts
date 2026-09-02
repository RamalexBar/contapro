export interface CompanyRecord {
  id: string;
  nit: string;
  legalName: string;
  name: string;
  /** Ver modules/electronic-invoicing/README.md, seccion "Proveedor tecnologico (MATIAS API)". */
  electronicInvoicingProvider: "DIRECT" | "MATIAS";
  /** Cifrado (credential-cipher.ts) -- descifrar solo justo antes de llamar al proveedor. */
  matiasApiTokenEncrypted: string | null;
}

/**
 * Lectura minima de Company para este modulo. No existe un ICompanyRepository generico en el
 * codebase (Company solo se toca directamente durante el registro) -- se define aqui, acotado
 * a este modulo, en lugar de crear un modulo "tenant" nuevo solo para esta unica lectura.
 */
export interface ICompanyReader {
  findByIdOrThrow(id: string): Promise<CompanyRecord>;
  /** Ver README, seccion "Proveedor tecnologico (MATIAS API)" -- endpoint
   * PUT /electronic-invoicing/provider-settings. encryptedToken ya viene cifrado (ver
   * shared/crypto/credential-cipher.ts), este metodo no cifra nada por su cuenta. */
  updateElectronicInvoicingProvider(companyId: string, provider: "DIRECT" | "MATIAS", encryptedToken: string | null): Promise<void>;
}
