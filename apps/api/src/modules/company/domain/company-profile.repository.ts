/** Datos fiscales DIAN de la empresa (ver README del modulo) -- distinto de ICompanyReader
 * (modules/electronic-invoicing), que solo lee los campos minimos que ese modulo necesita para
 * generar facturas. Este puerto expone el perfil completo, para leerlo/editarlo desde un
 * endpoint dedicado. */
export interface CompanyProfileRecord {
  id: string;
  name: string;
  legalName: string;
  nit: string;
  email: string;
  phone: string | null;
  documentType: string | null;
  dv: string | null;
  taxRegime: string | null;
  fiscalResponsibilities: string | null;
  address: string | null;
  municipality: string | null;
  department: string | null;
  municipalityCode: string | null;
}

export interface UpdateCompanyProfileData {
  legalName?: string;
  nit?: string;
  phone?: string | null;
  documentType?: string | null;
  dv?: string | null;
  taxRegime?: string | null;
  fiscalResponsibilities?: string | null;
  address?: string | null;
  municipality?: string | null;
  department?: string | null;
  municipalityCode?: string | null;
}

export interface ICompanyProfileRepository {
  findByIdOrThrow(id: string): Promise<CompanyProfileRecord>;
  update(id: string, data: UpdateCompanyProfileData): Promise<CompanyProfileRecord>;
  /** true si OTRA empresa ya usa ese NIT (Company.nit es unico en toda la plataforma). */
  isNitTakenByAnotherCompany(nit: string, companyId: string): Promise<boolean>;
  /** Cuantas facturas electronicas tiene la empresa (cualquier estado). */
  countElectronicInvoices(companyId: string): Promise<number>;
}
