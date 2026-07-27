import type { DashboardMetrics } from "@erp/shared-types";
import { prisma } from "../../../../shared/prisma/prisma-client";
import { getTenantContext } from "../../../../shared/context/request-context";

function startOfToday(): Date {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}

function startOfMonth(): Date {
  const d = new Date();
  d.setDate(1);
  d.setHours(0, 0, 0, 0);
  return d;
}

/**
 * Agregador de solo-lectura para el dashboard. A proposito consulta Prisma directamente
 * (sin repositorio por modulo) porque cruza varios dominios de negocio; es un modelo de
 * lectura (reporting), no una operacion transaccional de un modulo especifico.
 */
export class GetDashboardMetricsUseCase {
  async execute(): Promise<DashboardMetrics> {
    const ctx = getTenantContext();
    const branchId = ctx.branchId ?? undefined;
    const todayStart = startOfToday();
    const monthStart = startOfMonth();

    const [salesToday, salesMonth, saleItemsMonth, cogsMonth, activeCashSession, outOfStockCount, pendingInvoices, newCustomersMonth] =
      await Promise.all([
        prisma.sale.aggregate({
          where: { branchId, status: "COMPLETED", createdAt: { gte: todayStart } },
          _sum: { total: true },
          _count: true,
        }),
        prisma.sale.aggregate({
          where: { branchId, status: "COMPLETED", createdAt: { gte: monthStart } },
          _sum: { total: true },
          _count: true,
        }),
        prisma.saleItem.findMany({
          where: { sale: { branchId, status: "COMPLETED", createdAt: { gte: monthStart } } },
          select: { productId: true, quantity: true, total: true },
        }),
        prisma.stockMovement.aggregate({
          where: { branchId, type: "SALE_OUT", createdAt: { gte: monthStart } },
          _sum: { quantity: true },
        }),
        branchId
          ? prisma.cashSession.findFirst({
              where: { branchId, status: "OPEN" },
              include: { cashRegister: true },
              orderBy: { openedAt: "desc" },
            })
          : Promise.resolve(null),
        prisma.productBranchStock.count({ where: { branchId, quantity: { lte: 0 } } }),
        prisma.sale.count({ where: { branchId, status: "COMPLETED", paymentStatus: { in: ["PENDING", "PARTIAL", "CREDIT"] } } }),
        prisma.customer.count({ where: { createdAt: { gte: monthStart } } }),
      ]);

    // Costo de lo vendido en el mes (para estimar utilidad): se recalcula por producto usando
    // el costo actual como aproximacion (el costo historico exacto por movimiento se deja para
    // cuando el costeo FIFO/promedio este completamente implementado, ver docs/ALCANCE.md).
    void cogsMonth;
    const productIds = [...new Set(saleItemsMonth.map((i) => i.productId))];
    const products = await prisma.product.findMany({ where: { id: { in: productIds } } });
    const costByProduct = new Map(products.map((p) => [p.id, Number(p.currentCost)]));

    let revenueMonth = 0;
    let cogsEstimate = 0;
    const topProductsMap = new Map<string, { quantitySold: number; total: number }>();
    for (const item of saleItemsMonth) {
      const qty = Number(item.quantity);
      const total = Number(item.total);
      revenueMonth += total;
      cogsEstimate += (costByProduct.get(item.productId) ?? 0) * qty;
      const current = topProductsMap.get(item.productId) ?? { quantitySold: 0, total: 0 };
      current.quantitySold += qty;
      current.total += total;
      topProductsMap.set(item.productId, current);
    }

    const topProductsSorted = [...topProductsMap.entries()].sort((a, b) => b[1].quantitySold - a[1].quantitySold).slice(0, 5);
    const topProducts = topProductsSorted.map(([productId, data]) => ({
      productId,
      name: products.find((p) => p.id === productId)?.name ?? productId,
      quantitySold: data.quantitySold,
      total: data.total,
    }));

    const openedByUser = activeCashSession
      ? await prisma.user.findFirst({ where: { id: activeCashSession.openedByUserId } })
      : null;

    return {
      salesToday: { total: Number(salesToday._sum.total ?? 0), count: salesToday._count },
      salesMonth: { total: Number(salesMonth._sum.total ?? 0), count: salesMonth._count },
      estimatedProfitMonth: Math.round((revenueMonth - cogsEstimate) * 100) / 100,
      activeCashSession: activeCashSession
        ? {
            id: activeCashSession.id,
            cashRegisterName: activeCashSession.cashRegister.name,
            openedByUserName: openedByUser?.fullName ?? activeCashSession.openedByUserId,
            openedAt: activeCashSession.openedAt.toISOString(),
            openingAmount: Number(activeCashSession.openingAmount),
          }
        : null,
      outOfStockCount,
      topProducts,
      pendingInvoices,
      newCustomersMonth,
    };
  }
}
