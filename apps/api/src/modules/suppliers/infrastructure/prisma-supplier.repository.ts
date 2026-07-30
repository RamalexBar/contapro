import { Prisma } from "@erp/database";
import { prisma } from "../../../shared/prisma/prisma-client";
import { getTenantContext } from "../../../shared/context/request-context";
import { ConflictError, NotFoundError } from "../../../shared/errors/app-error";
import type { CreateSupplierData, ISupplierRepository, SupplierRecord } from "../domain/supplier.repository";

function toRecord(row: {
  id: string;
  name: string;
  nit: string;
  contactName: string | null;
  phone: string | null;
  email: string | null;
  address: string | null;
  isActive: boolean;
  isObligatedToInvoice: boolean;
}): SupplierRecord {
  return {
    id: row.id,
    name: row.name,
    nit: row.nit,
    contactName: row.contactName,
    phone: row.phone,
    email: row.email,
    address: row.address,
    isActive: row.isActive,
    isObligatedToInvoice: row.isObligatedToInvoice,
  };
}

export class PrismaSupplierRepository implements ISupplierRepository {
  async create(data: CreateSupplierData): Promise<SupplierRecord> {
    try {
      const row = await prisma.supplier.create({
        data: {
          companyId: getTenantContext().companyId,
          name: data.name,
          nit: data.nit,
          contactName: data.contactName,
          phone: data.phone,
          email: data.email,
          address: data.address,
          isObligatedToInvoice: data.isObligatedToInvoice ?? true,
        },
      });
      return toRecord(row);
    } catch (err) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
        throw new ConflictError(`Ya existe un proveedor con el NIT ${data.nit}`);
      }
      throw err;
    }
  }

  async list(search?: string): Promise<SupplierRecord[]> {
    const rows = await prisma.supplier.findMany({
      where: { isActive: true, ...(search ? { name: { contains: search, mode: "insensitive" } } : {}) },
      orderBy: { name: "asc" },
      take: 100,
    });
    return rows.map(toRecord);
  }

  async findByIdOrThrow(id: string): Promise<SupplierRecord> {
    const row = await prisma.supplier.findFirst({ where: { id } });
    if (!row) throw new NotFoundError("Supplier", id);
    return toRecord(row);
  }
}
