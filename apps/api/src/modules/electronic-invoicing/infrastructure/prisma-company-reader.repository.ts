import { basePrisma } from "@erp/database";
import { NotFoundError } from "../../../shared/errors/app-error";
import type { CompanyRecord, ICompanyReader } from "../domain/company-reader.repository";

/**
 * Usa basePrisma (sin la extension de aislamiento tenant) a proposito: Company no esta en
 * TENANT_MODELS -- ES el tenant, no algo que le pertenezca -- y esta lectura ya se limita al
 * companyId del contexto de la request (ver GenerateElectronicInvoiceUseCase).
 */
export class PrismaCompanyReaderRepository implements ICompanyReader {
  async findByIdOrThrow(id: string): Promise<CompanyRecord> {
    const row = await basePrisma.company.findFirst({ where: { id } });
    if (!row) throw new NotFoundError("Company", id);
    return { id: row.id, nit: row.nit, legalName: row.legalName, name: row.name };
  }
}
