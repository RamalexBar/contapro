import { prisma } from "../../../shared/prisma/prisma-client";
import { getTenantContext } from "../../../shared/context/request-context";
import { NotFoundError } from "../../../shared/errors/app-error";
import type { CreatePurchaseData, IPurchaseRepository, PurchaseRecord } from "../domain/purchase.repository";

type PurchaseRow = {
  id: string;
  branchId: string;
  supplierId: string;
  invoiceNumber: string;
  subtotal: unknown;
  taxTotal: unknown;
  total: unknown;
  status: string;
  createdAt: Date;
  accountsPayable: { id: string; dueDate: Date }[];
};

function toRecord(row: PurchaseRow): PurchaseRecord {
  const accountPayable = row.accountsPayable[0];
  return {
    id: row.id,
    branchId: row.branchId,
    supplierId: row.supplierId,
    invoiceNumber: row.invoiceNumber,
    subtotal: Number(row.subtotal),
    taxTotal: Number(row.taxTotal),
    total: Number(row.total),
    status: row.status,
    createdAt: row.createdAt,
    accountPayableId: accountPayable.id,
    dueDate: accountPayable.dueDate,
  };
}

const PURCHASE_INCLUDE = { accountsPayable: true } as const;

export class PrismaPurchaseRepository implements IPurchaseRepository {
  async create(data: CreatePurchaseData): Promise<PurchaseRecord> {
    const companyId = getTenantContext().companyId;

    const row = await prisma.$transaction(async (tx) => {
      const purchase = await tx.purchase.create({
        data: {
          companyId,
          branchId: data.branchId,
          supplierId: data.supplierId,
          invoiceNumber: data.invoiceNumber,
          subtotal: data.subtotal,
          taxTotal: data.taxTotal,
          total: data.total,
          status: "REGISTERED",
        },
      });

      await tx.accountPayable.create({
        data: {
          companyId,
          supplierId: data.supplierId,
          purchaseId: purchase.id,
          amount: data.total,
          balance: data.total,
          dueDate: data.dueDate,
          status: "PENDING",
        },
      });

      return tx.purchase.findFirstOrThrow({ where: { id: purchase.id }, include: PURCHASE_INCLUDE });
    });

    return toRecord(row);
  }

  async findByIdOrThrow(id: string): Promise<PurchaseRecord> {
    const row = await prisma.purchase.findFirst({ where: { id }, include: PURCHASE_INCLUDE });
    if (!row) throw new NotFoundError("Purchase", id);
    return toRecord(row);
  }

  async list(filters: { take?: number; skip?: number }): Promise<PurchaseRecord[]> {
    const rows = await prisma.purchase.findMany({
      include: PURCHASE_INCLUDE,
      orderBy: { createdAt: "desc" },
      take: filters.take ?? 50,
      skip: filters.skip ?? 0,
    });
    return rows.map(toRecord);
  }
}
