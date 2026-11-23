import { basePrisma } from "@erp/database";
import { NotFoundError } from "../../../shared/errors/app-error";
import type { CompanyRecord, ICompanyReader } from "../domain/company-reader.repository";

type CompanyRow = { id: string; nit: string; legalName: string; name: string; payrollExemptArt1141: boolean };

function toRecord(row: CompanyRow): CompanyRecord {
  return { id: row.id, nit: row.nit, legalName: row.legalName, name: row.name, payrollExemptArt1141: row.payrollExemptArt1141 };
}

/**
 * Usa basePrisma (sin la extension de aislamiento tenant) a proposito: Company no esta en
 * TENANT_MODELS -- ES el tenant, no algo que le pertenezca -- y estas operaciones siempre reciben el
 * companyId del contexto de la request (ver PayrollController).
 */
export class PrismaCompanyReaderRepository implements ICompanyReader {
  async findByIdOrThrow(id: string): Promise<CompanyRecord> {
    const row = await basePrisma.company.findFirst({ where: { id } });
    if (!row) throw new NotFoundError("Company", id);
    return toRecord(row);
  }

  async setPayrollExemptArt1141(id: string, exempt: boolean): Promise<CompanyRecord> {
    await this.findByIdOrThrow(id);
    const row = await basePrisma.company.update({ where: { id }, data: { payrollExemptArt1141: exempt } });
    return toRecord(row);
  }
}
