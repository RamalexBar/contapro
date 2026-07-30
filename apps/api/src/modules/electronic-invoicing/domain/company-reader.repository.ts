export interface CompanyRecord {
  id: string;
  nit: string;
  legalName: string;
  name: string;
}

/**
 * Lectura minima de Company para este modulo. No existe un ICompanyRepository generico en el
 * codebase (Company solo se toca directamente durante el registro) -- se define aqui, acotado
 * a este modulo, en lugar de crear un modulo "tenant" nuevo solo para esta unica lectura.
 */
export interface ICompanyReader {
  findByIdOrThrow(id: string): Promise<CompanyRecord>;
}
