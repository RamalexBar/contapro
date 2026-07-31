export interface CompanyRecord {
  id: string;
  nit: string;
  legalName: string;
  name: string;
}

/**
 * Lectura minima de Company para este modulo (mismo patron que
 * electronic-invoicing/domain/company-reader.repository.ts): no existe un ICompanyRepository
 * generico en el codebase, se define acotado a cada modulo que lo necesita.
 */
export interface ICompanyReader {
  findByIdOrThrow(id: string): Promise<CompanyRecord>;
}
