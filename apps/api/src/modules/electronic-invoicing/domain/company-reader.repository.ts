export interface CompanyRecord {
  id: string;
  nit: string;
  legalName: string;
  name: string;
  logoUrl: string | null;
  /** Ver modules/electronic-invoicing/README.md, seccion "Proveedor tecnologico (Factus API)". */
  electronicInvoicingProvider: "DIRECT" | "FACTUS";
  /** Cifrado (credential-cipher.ts): JSON de {clientId, clientSecret, email, password,
   * numberingRangeId} -- ver factus-invoicing-client.ts. */
  factusCredentialsEncrypted: string | null;
  /** Datos de cumplimiento/visualizacion, usados para completar el encabezado del RIDE impreso
   * (ver ride-data-mapper.ts, RideCompanyInfo) -- no viajan en el XML firmado. */
  address: string | null;
  municipality: string | null;
  department: string | null;
  taxRegime: string | null;
  fiscalResponsibilities: string | null;
  phone: string | null;
  email: string;
}

/**
 * Lectura minima de Company para este modulo. No existe un ICompanyRepository generico en el
 * codebase (Company solo se toca directamente durante el registro) -- se define aqui, acotado
 * a este modulo, en lugar de crear un modulo "tenant" nuevo solo para esta unica lectura.
 */
export interface ICompanyReader {
  findByIdOrThrow(id: string): Promise<CompanyRecord>;
  /** Ver README, seccion "Proveedor tecnologico (Factus API)" -- endpoint
   * PUT /electronic-invoicing/provider-settings. La credencial ya viene cifrada (ver
   * shared/crypto/credential-cipher.ts), este metodo no cifra nada por su cuenta. */
  updateElectronicInvoicingProvider(
    companyId: string,
    provider: "DIRECT" | "FACTUS",
    credentials: { factusCredentialsEncrypted?: string | null }
  ): Promise<void>;
}
