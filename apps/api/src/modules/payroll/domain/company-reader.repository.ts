export interface CompanyRecord {
  id: string;
  nit: string;
  legalName: string;
  name: string;
  /** Exoneracion de aportes art. 114-1 E.T. (ver PayrollCompanyOptions en payroll-calculator.ts). */
  payrollExemptArt1141: boolean;
}

/**
 * Lectura minima de Company para este modulo (mismo patron que
 * electronic-invoicing/domain/company-reader.repository.ts): no existe un ICompanyRepository
 * generico en el codebase, se define acotado a cada modulo que lo necesita.
 */
export interface ICompanyReader {
  findByIdOrThrow(id: string): Promise<CompanyRecord>;
  /** Unica configuracion de Company que escribe este modulo (Nomina -> Configuracion). */
  setPayrollExemptArt1141(id: string, exempt: boolean): Promise<CompanyRecord>;
}
