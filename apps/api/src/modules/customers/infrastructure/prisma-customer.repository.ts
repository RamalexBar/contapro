import { prisma } from "../../../shared/prisma/prisma-client";
import { getTenantContext } from "../../../shared/context/request-context";
import { NotFoundError } from "../../../shared/errors/app-error";
import type { CreateCustomerData, CustomerRecord, ICustomerRepository } from "../domain/customer.repository";

function toRecord(row: {
  id: string;
  documentType: string;
  documentNumber: string;
  name: string;
  email: string | null;
  phone: string | null;
  creditLimit: unknown;
  currentBalance: unknown;
  isActive: boolean;
  priceListId: string | null;
  municipalityCode: string | null;
}): CustomerRecord {
  return {
    id: row.id,
    documentType: row.documentType,
    documentNumber: row.documentNumber,
    name: row.name,
    email: row.email,
    phone: row.phone,
    creditLimit: Number(row.creditLimit),
    currentBalance: Number(row.currentBalance),
    isActive: row.isActive,
    priceListId: row.priceListId,
    municipalityCode: row.municipalityCode,
  };
}

export class PrismaCustomerRepository implements ICustomerRepository {
  async create(data: CreateCustomerData): Promise<CustomerRecord> {
    const row = await prisma.customer.create({
      data: {
        companyId: getTenantContext().companyId,
        documentType: data.documentType,
        documentNumber: data.documentNumber,
        name: data.name,
        email: data.email,
        phone: data.phone,
        address: data.address,
        creditLimit: data.creditLimit ?? 0,
        priceListId: data.priceListId,
        municipalityCode: data.municipalityCode,
      },
    });
    return toRecord(row);
  }

  async list(search?: string): Promise<CustomerRecord[]> {
    const rows = await prisma.customer.findMany({
      where: { isActive: true, ...(search ? { name: { contains: search, mode: "insensitive" } } : {}) },
      orderBy: { name: "asc" },
      take: 100,
    });
    return rows.map(toRecord);
  }

  async findByIdOrThrow(id: string): Promise<CustomerRecord> {
    const row = await prisma.customer.findFirst({ where: { id, companyId: getTenantContext().companyId } });
    if (!row) throw new NotFoundError("Customer", id);
    return toRecord(row);
  }

  async updatePriceList(id: string, priceListId: string | null): Promise<CustomerRecord> {
    // findByIdOrThrow confirma pertenencia al tenant primero -- update() por id no queda cubierto
    // por tenant.extension.ts, mismo criterio ya aplicado en otros repos de este repo.
    await this.findByIdOrThrow(id);
    const row = await prisma.customer.update({ where: { id }, data: { priceListId } });
    return toRecord(row);
  }
}
