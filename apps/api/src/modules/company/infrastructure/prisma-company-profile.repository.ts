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
  };
}
