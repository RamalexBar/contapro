import { round2 } from "@erp/shared-utils";
import { prisma } from "../../../shared/prisma/prisma-client";
import { getTenantContext } from "../../../shared/context/request-context";
import { NotFoundError } from "../../../shared/errors/app-error";
import type {
  CreatePurchaseOrderData,
  IPurchaseOrderRepository,
  PurchaseOrderItemRecord,
  PurchaseOrderRecord,
  PurchaseOrderWithItems,
} from "../domain/purchase-order.repository";

type PurchaseOrderRow = {
  id: string;
  branchId: string;
  supplierId: string;
  status: string;
  expectedDate: Date | null;
  total: unknown;
  createdAt: Date;
};

function toRecord(row: PurchaseOrderRow): PurchaseOrderRecord {
  return {
    id: row.id,
    branchId: row.branchId,
    supplierId: row.supplierId,
    status: row.status,
    expectedDate: row.expectedDate,
    total: Number(row.total),
    createdAt: row.createdAt,
  };
}

export class PrismaPurchaseOrderRepository implements IPurchaseOrderRepository {
  async create(data: CreatePurchaseOrderData, createdByUserId: string): Promise<PurchaseOrderRecord> {
    const companyId = getTenantContext().companyId;
    const total = round2(data.items.reduce((sum, item) => sum + item.quantity * item.unitCost, 0));

    const row = await prisma.purchaseOrder.create({
      data: {
        companyId,
        branchId: data.branchId,
        supplierId: data.supplierId,
        expectedDate: data.expectedDate,
        total,
        createdByUserId,
        status: "DRAFT",
        items: {
          create: data.items.map((item) => ({
            productId: item.productId,
            quantity: item.quantity,
            unitCost: item.unitCost,
            total: round2(item.quantity * item.unitCost),
          })),
        },
      },
    });

    return toRecord(row);
  }

  async updateStatus(id: string, status: string): Promise<PurchaseOrderRecord> {
    // findFirst (via findByIdOrThrow) queda auto-scopeado por tenant.extension.ts; el update por
    // id que sigue no -- se confirma pertenencia al tenant primero, mismo patron que
    // PrismaJournalEntryRepository.updateStatus.
    await this.findByIdOrThrow(id);
    const row = await prisma.purchaseOrder.update({ where: { id }, data: { status } });
    return toRecord(row);
  }

  async findByIdOrThrow(id: string): Promise<PurchaseOrderWithItems> {
    const row = await prisma.purchaseOrder.findFirst({ where: { id }, include: { items: true } });
    if (!row) throw new NotFoundError("PurchaseOrder", id);

    const received = await prisma.goodsReceiptItem.groupBy({
      by: ["productId"],
      where: { goodsReceipt: { purchaseOrderId: id } },
      _sum: { quantity: true },
    });
    const receivedByProduct = new Map(received.map((r) => [r.productId, Number(r._sum.quantity ?? 0)]));

    const items: PurchaseOrderItemRecord[] = row.items.map((item) => ({
      id: item.id,
      productId: item.productId,
      quantity: Number(item.quantity),
      unitCost: Number(item.unitCost),
      total: Number(item.total),
      receivedQuantity: receivedByProduct.get(item.productId) ?? 0,
    }));

    return { ...toRecord(row), items };
  }

  async list(): Promise<PurchaseOrderRecord[]> {
    const rows = await prisma.purchaseOrder.findMany({ orderBy: { createdAt: "desc" } });
    return rows.map(toRecord);
  }
}
