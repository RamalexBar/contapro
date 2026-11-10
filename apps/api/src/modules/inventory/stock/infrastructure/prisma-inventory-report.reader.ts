import { prisma } from "../../../../shared/prisma/prisma-client";
import type { IInventoryReportReader, StockLevelSnapshot } from "../domain/inventory-report.reader";

export class PrismaInventoryReportReader implements IInventoryReportReader {
  async listStockLevels(filter: { branchId?: string; withLayers: boolean }): Promise<StockLevelSnapshot[]> {
    const [stocks, branches] = await Promise.all([
      prisma.productBranchStock.findMany({
        where: { branchId: filter.branchId, product: { isActive: true } },
        select: {
          productId: true,
          branchId: true,
          quantity: true,
          minStock: true,
          maxStock: true,
          product: { select: { sku: true, name: true, unit: true, currentCost: true, category: { select: { name: true } } } },
        },
      }),
      prisma.branch.findMany({ where: filter.branchId ? { id: filter.branchId } : {}, select: { id: true, name: true } }),
    ]);
    const branchNameById = new Map(branches.map((b) => [b.id, b.name]));

    const layersByKey = new Map<string, StockLevelSnapshot["layers"]>();
    if (filter.withLayers) {
      const batches = await prisma.batch.findMany({
        where: { branchId: filter.branchId, quantity: { gt: 0 } },
        orderBy: [{ createdAt: "asc" }, { id: "asc" }],
        select: { productId: true, branchId: true, quantity: true, costAtEntry: true, createdAt: true, batchNumber: true },
      });
      for (const b of batches) {
        const key = `${b.productId}:${b.branchId}`;
        const list = layersByKey.get(key) ?? [];
        list.push({ quantity: Number(b.quantity), unitCost: Number(b.costAtEntry), enteredAt: b.createdAt, batchNumber: b.batchNumber });
        layersByKey.set(key, list);
      }
    }

    return stocks
      .filter((s) => branchNameById.has(s.branchId))
      .map((s) => ({
        productId: s.productId,
        sku: s.product.sku,
        name: s.product.name,
        categoryName: s.product.category?.name ?? null,
        unit: s.product.unit,
        branchId: s.branchId,
        branchName: branchNameById.get(s.branchId) ?? "",
        quantity: Number(s.quantity),
        minStock: Number(s.minStock),
        maxStock: Number(s.maxStock),
        currentCost: Number(s.product.currentCost),
        layers: layersByKey.get(`${s.productId}:${s.branchId}`) ?? [],
      }));
  }
}
