import { prisma } from "../../../../shared/prisma/prisma-client";
import { getTenantContext } from "../../../../shared/context/request-context";
import type { IKardexRepository, KardexEntryRecord, ListKardexFilter } from "../domain/kardex.repository";

export class PrismaKardexRepository implements IKardexRepository {
  async list(filter: ListKardexFilter): Promise<KardexEntryRecord[]> {
    const companyId = getTenantContext().companyId;
    const rows = await prisma.kardex.findMany({
      where: {
        companyId,
        productId: filter.productId,
        branchId: filter.branchId,
        createdAt: { gte: filter.from, lte: filter.to },
      },
      orderBy: { createdAt: "asc" },
    });

    // Kardex.movementId no es una relacion de Prisma (referencia suelta a StockMovement), asi
    // que se resuelve con una segunda consulta en vez de un include.
    const movements = await prisma.stockMovement.findMany({
      where: { id: { in: rows.map((r) => r.movementId) } },
      select: { id: true, type: true, quantity: true },
    });
    const movementById = new Map(movements.map((m) => [m.id, m]));

    return rows.map((row) => {
      const movement = movementById.get(row.movementId);
      return {
        id: row.id,
        branchId: row.branchId,
        productId: row.productId,
        movementId: row.movementId,
        movementType: movement?.type ?? "UNKNOWN",
        movementQuantity: Number(movement?.quantity ?? 0),
        balanceQty: Number(row.balanceQty),
        balanceCost: Number(row.balanceCost),
        averageCost: Number(row.averageCost),
        createdAt: row.createdAt,
      };
    });
  }
}
