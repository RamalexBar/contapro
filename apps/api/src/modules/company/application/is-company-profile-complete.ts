import type { CompanyProfileRecord } from "../domain/company-profile.repository";

/** Campos exigidos antes de poder crear la primera factura manual (modules/manual-invoicing) --
 * ver la decision documentada en manual-invoicing/README.md. No incluye `phone` (opcional en
 * cualquier flujo de este codebase) ni `municipalityCode` (dato DANE independiente, no capturado
 * por el wizard de perfil). Funcion pura para poder testearla sin repos/DB. */
const REQUIRED_FIELDS = [
  "documentType",
  "dv",
  "taxRegime",
  "fiscalResponsibilities",
  "address",
  "municipality",
  "department",
] as const satisfies readonly (keyof CompanyProfileRecord)[];

export interface CompanyProfileCompleteness {
  complete: boolean;
  missingFields: string[];
}

export function isCompanyProfileComplete(company: CompanyProfileRecord): CompanyProfileCompleteness {
  const missingFields = REQUIRED_FIELDS.filter((field) => !company[field]);
  return { complete: missingFields.length === 0, missingFields };
}
