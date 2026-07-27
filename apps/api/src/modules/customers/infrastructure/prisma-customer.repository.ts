import { prisma } from "../../../shared/prisma/prisma-client";
import { getTenantContext } from "../../../shared/context/request-context";
import type { CreateCustomerData, CustomerRecord, ICustomerRepository } from "../domain/customer.repository";

function toRecord(row: {
  id: string;
  documentType: string;
  documentNumber: string;
  name: string;
  creditLimit: unknown;
  currentBalance: unknown;
  isActive: boolean;
}): CustomerRecord {
  return {
    id: row.id,
    documentType: row.documentType,
    documentNumber: row.documentNumber,
    name: row.name,
    creditLimit: Number(row.creditLimit),
    currentBalance: Number(row.currentBalance),
    isActive: row.isActive,
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
}
