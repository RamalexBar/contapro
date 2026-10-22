import { apiFetch } from "../../../lib/api-client";

export interface CompanyProfile {
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
  economicActivity: string | null;
  whatsapp: string | null;
  website: string | null;
  instagram: string | null;
  receiptHeader: string | null;
  receiptFooter: string | null;
  /** Data URL del logo ("data:image/png;base64,..."). */
  logoUrl: string | null;
  complete: boolean;
  missingFields: string[];
}

export interface UpdateCompanyProfileInput {
  name?: string;
  email?: string;
  economicActivity?: string | null;
  whatsapp?: string | null;
  website?: string | null;
  instagram?: string | null;
  receiptHeader?: string | null;
  receiptFooter?: string | null;
  logoUrl?: string | null;
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

export function getCompanyProfile(): Promise<CompanyProfile> {
  return apiFetch("/company/profile");
}

export function updateCompanyProfile(input: UpdateCompanyProfileInput): Promise<CompanyProfile> {
  return apiFetch("/company/profile", { method: "PUT", body: input });
}
