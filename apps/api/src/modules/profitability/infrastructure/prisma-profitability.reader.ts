import { prisma } from "../../../shared/prisma/prisma-client";
import type { IProfitabilityReader, ProfitabilityFilter, ProfitabilityLine } from "../domain/profitability.reader";

const SOLD_STATUSES = ["COMPLETED", "RETURNED_PARTIAL", "RETURNED_FULL"] as const;

/**
 * Ventas completadas del periodo (lineas positivas) y devoluciones hechas en el periodo (lineas negativas). El costo de
 * cada linea vendida es SaleItem.costTotal (PEPS real, fijado al completar la venta). Una devolucion revierte la venta
 * neta proporcional de su linea y, si la mercancia volvio al inventario, el costo con el que habia salido -- el mismo
 * criterio con que PrismaReturnRepository reingresa la capa y reversa el costo en contabilidad.
 */
export class PrismaProfitabilityReader implements IProfitabilityReader {
  async listLines(filter: ProfitabilityFilter): Promise<ProfitabilityLine[]> {
    const createdAt = { gte: filter.from, lte: filter.to };
    const [sales, returns] = await Promise.all([
      prisma.sale.findMany({
        where: { status: { in: [...SOLD_STATUSES] }, createdAt, branchId: filter.branchId },
        select: {
          customerId: true,
          items: { select: { productId: true, quantity: true, total: true, taxAmount: true, costTotal: true } },
        },
      }),
      prisma.return.findMany({
        where: { createdAt, branchId: filter.branchId, status: { notIn: ["CANCELLED", "REJECTED"] } },
        select: {
          saleId: true,
          customerId: true,
          items: { select: { saleItemId: true, productId: true, quantity: true, restockedToBranch: true } },
        },
      }),
    ]);

    // Lineas de venta originales de las devoluciones (pueden ser de ventas de otro periodo). SaleItem no tiene
    // companyId propio: se lee a traves de su Sale, que si queda filtrada por la empresa.
    const returnedSaleItemIds = [...new Set(returns.flatMap((r) => r.items.map((i) => i.saleItemId)))];
    const originalItems = returnedSaleItemIds.length
      ? await prisma.sale.findMany({
          where: { id: { in: [...new Set(returns.map((r) => r.saleId))] } },
          select: {
            customerId: true,
            items: {
              where: { id: { in: returnedSaleItemIds } },
              select: { id: true, quantity: true, total: true, taxAmount: true, costTotal: true },
            },
          },
        })
      : [];
    const originalById = new Map(originalItems.flatMap((s) => s.items.map((i) => [i.id, { ...i, customerId: s.customerId }])));

    const productIds = new Set<string>();
    const customerIds = new Set<string>();
    for (const s of sales) {
      if (s.customerId) customerIds.add(s.customerId);
      for (const i of s.items) productIds.add(i.productId);
    }
    for (const r of returns) {
      if (r.customerId) customerIds.add(r.customerId);
      for (const i of r.items) productIds.add(i.productId);
    }

    const [products, customers] = await Promise.all([
      productIds.size
        ? prisma.product.findMany({
            where: { id: { in: [...productIds] } },
            select: { id: true, name: true, sku: true, currentCost: true, category: { select: { id: true, name: true } } },
          })
        : [],
      customerIds.size ? prisma.customer.findMany({ where: { id: { in: [...customerIds] } }, select: { id: true, name: true } }) : [],
    ]);
    const productById = new Map(products.map((p) => [p.id, p]));
    const customerNameById = new Map(customers.map((c) => [c.id, c.name]));

    const base = (productId: string, customerId: string | null) => {
      const product = productById.get(productId);
      return {
        productId,
        productName: product?.name ?? "Producto eliminado",
        sku: product?.sku ?? "",
        categoryId: product?.category?.id ?? null,
        categoryName: product?.category?.name ?? null,
        customerId: customerId && customerNameById.has(customerId) ? customerId : null,
        customerName: customerId ? (customerNameById.get(customerId) ?? null) : null,
      };
    };

    const lines: ProfitabilityLine[] = [];
    for (const sale of sales) {
      for (const item of sale.items) {
        const quantity = Number(item.quantity);
        const estimated = item.costTotal === null;
        lines.push({
          ...base(item.productId, sale.customerId),
          quantity,
          revenue: Number(item.total) - Number(item.taxAmount),
          cost: estimated ? quantity * Number(productById.get(item.productId)?.currentCost ?? 0) : Number(item.costTotal),
          estimatedCost: estimated,
        });
      }
    }

    for (const ret of returns) {
      for (const item of ret.items) {
        const original = originalById.get(item.saleItemId);
        const originalQty = Number(original?.quantity ?? 0);
        if (!original || originalQty <= 0) continue;
        const share = Number(item.quantity) / originalQty;
        const estimated = original.costTotal === null;
        const originalCost = estimated
          ? originalQty * Number(productById.get(item.productId)?.currentCost ?? 0)
          : Number(original.costTotal);
        lines.push({
          ...base(item.productId, ret.customerId ?? original.customerId),
          quantity: -Number(item.quantity),
          revenue: -(Number(original.total) - Number(original.taxAmount)) * share,
          cost: item.restockedToBranch ? -originalCost * share : 0,
          estimatedCost: estimated,
        });
      }
    }

    return lines;
  }
}
