import { basePrisma } from "@erp/database";
import { NotFoundError } from "../../../shared/errors/app-error";
import type { CompanyProfileRecord, ICompanyProfileRepository, UpdateCompanyProfileData } from "../domain/company-profile.repository";

/** Usa basePrisma a proposito, mismo criterio que PrismaCompanyReaderRepository
 * (modules/electronic-invoicing): Company no esta en TENANT_MODELS -- ES el tenant, no algo que
 * le pertenezca. */
export class PrismaCompanyProfileRepository implements ICompanyProfileRepository {
  async findByIdOrThrow(id: string): Promise<CompanyProfileRecord> {
    const row = await basePrisma.company.findFirst({ where: { id } });
    if (!row) throw new NotFoundError("Company", id);
    return toRecord(row);
  }

  async update(id: string, data: UpdateCompanyProfileData): Promise<CompanyProfileRecord> {
    const row = await basePrisma.company.update({ where: { id }, data });
    return toRecord(row);
  }

  async isNitTakenByAnotherCompany(nit: string, companyId: string): Promise<boolean> {
    return (await basePrisma.company.count({ where: { nit, id: { not: companyId } } })) > 0;
  }

  async countElectronicInvoices(companyId: string): Promise<number> {
    return basePrisma.electronicInvoice.count({ where: { companyId } });
  }
}

function toRecord(row: {
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
  logoUrl: string | null;
}): CompanyProfileRecord {
  return {
    id: row.id,
    name: row.name,
    legalName: row.legalName,
    nit: row.nit,
    email: row.email,
    phone: row.phone,
    documentType: row.documentType,
    dv: row.dv,
    taxRegime: row.taxRegime,
    fiscalResponsibilities: row.fiscalResponsibilities,
    address: row.address,
    municipality: row.municipality,
    department: row.department,
    municipalityCode: row.municipalityCode,
    economicActivity: row.economicActivity,
    whatsapp: row.whatsapp,
    website: row.website,
    instagram: row.instagram,
    receiptHeader: row.receiptHeader,
    receiptFooter: row.receiptFooter,
    logoUrl: row.logoUrl,
  };
}
