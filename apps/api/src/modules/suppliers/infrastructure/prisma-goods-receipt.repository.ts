import { prisma } from "../../../shared/prisma/prisma-client";
import { getTenantContext } from "../../../shared/context/request-context";
import { NotFoundError } from "../../../shared/errors/app-error";
import type { CreateGoodsReceiptData, GoodsReceiptRecord, IGoodsReceiptRepository } from "../domain/goods-receipt.repository";

type GoodsReceiptRow = {
  id: string;
  branchId: string;
  supplierId: string;
  purchaseOrderId: string | null;
  receivedByUserId: string;
  createdAt: Date;
  items: { id: string; productId: string; quantity: unknown; unitCost: unknown; batchNumber: string | null; expirationDate: Date | null }[];
};

function toRecord(row: GoodsReceiptRow): GoodsReceiptRecord {
  return {
    id: row.id,
    branchId: row.branchId,
    supplierId: row.supplierId,
    purchaseOrderId: row.purchaseOrderId,
    receivedByUserId: row.receivedByUserId,
    createdAt: row.createdAt,
    items: row.items.map((item) => ({
      id: item.id,
      productId: item.productId,
      quantity: Number(item.quantity),
      unitCost: Number(item.unitCost),
      batchNumber: item.batchNumber,
      expirationDate: item.expirationDate,
    })),
  };
}

const INCLUDE = { items: true } as const;

export class PrismaGoodsReceiptRepository implements IGoodsReceiptRepository {
  async create(data: CreateGoodsReceiptData, receivedByUserId: string): Promise<GoodsReceiptRecord> {
    const companyId = getTenantContext().companyId;

    const row = await prisma.goodsReceipt.create({
      data: {
        companyId,
        branchId: data.branchId,
        supplierId: data.supplierId,
        purchaseOrderId: data.purchaseOrderId,
        receivedByUserId,
        items: {
          create: data.items.map((item) => ({
            productId: item.productId,
            quantity: item.quantity,
            unitCost: item.unitCost,
            batchNumber: item.batchNumber,
            expirationDate: item.expirationDate,
          })),
        },
      },
      include: INCLUDE,
    });

    return toRecord(row);
  }

  async findByIdOrThrow(id: string): Promise<GoodsReceiptRecord> {
    const row = await prisma.goodsReceipt.findFirst({ where: { id }, include: INCLUDE });
    if (!row) throw new NotFoundError("GoodsReceipt", id);
    return toRecord(row);
  }

  async list(): Promise<GoodsReceiptRecord[]> {
    const rows = await prisma.goodsReceipt.findMany({ include: INCLUDE, orderBy: { createdAt: "desc" } });
    return rows.map(toRecord);
  }
}
