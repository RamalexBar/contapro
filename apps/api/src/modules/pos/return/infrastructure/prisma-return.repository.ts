import { prisma } from "../../../../shared/prisma/prisma-client";
import { getTenantContext } from "../../../../shared/context/request-context";
import { NotFoundError, ValidationError } from "../../../../shared/errors/app-error";
import { recordKardexEntry } from "../../../inventory/stock/infrastructure/kardex-writer";
import type { CreateReturnData, IReturnRepository, ReturnRecord } from "../domain/return.repository";

function toRecord(row: {
  id: string;
  branchId: string;
  saleId: string;
  customerId: string | null;
  reason: string;
  status: string;
  total: unknown;
  createdAt: Date;
  items: Array<{
    id: string;
    saleItemId: string;
    productId: string;
    quantity: unknown;
    unitPrice: unknown;
    total: unknown;
    restockedToBranch: boolean;
  }>;
}): ReturnRecord {
  return {
    id: row.id,
    branchId: row.branchId,
    saleId: row.saleId,
    customerId: row.customerId,
    reason: row.reason,
    status: row.status,
    total: Number(row.total),
    createdAt: row.createdAt,
    items: row.items.map((item) => ({
      id: item.id,
      saleItemId: item.saleItemId,
      productId: item.productId,
      quantity: Number(item.quantity),
      unitPrice: Number(item.unitPrice),
      total: Number(item.total),
      restockedToBranch: item.restockedToBranch,
    })),
  };
}

export class PrismaReturnRepository implements IReturnRepository {
  async create(data: CreateReturnData): Promise<ReturnRecord> {
    const companyId = getTenantContext().companyId;

    const row = await prisma.$transaction(async (tx) => {
      // findFirst queda auto-scoped por companyId via el tenant extension (ver
      // tenant.extension.ts) -- confirma que la venta pertenece al tenant antes de leer/escribir
      // nada mas en esta transaccion.
      const sale = await tx.sale.findFirst({ where: { id: data.saleId }, include: { items: true } });
      if (!sale) throw new NotFoundError("Sale", data.saleId);

      const saleItemIds = sale.items.map((i) => i.id);
      // ReturnItem no tiene companyId propio (igual que SaleItem) -- queda scoped a traves de
      // saleItemIds, que ya vienen de un Sale verificado del tenant arriba.
      const existingReturnItems = await tx.returnItem.findMany({ where: { saleItemId: { in: saleItemIds } } });
      const alreadyReturnedByItem = new Map<string, number>();
      for (const ri of existingReturnItems) {
        alreadyReturnedByItem.set(ri.saleItemId, (alreadyReturnedByItem.get(ri.saleItemId) ?? 0) + Number(ri.quantity));
      }

      // Validacion de concurrencia DENTRO de la transaccion (mismo criterio que
      // RegisterSupplierPaymentUseCase valida amount <= balance): dos devoluciones concurrentes
      // del mismo SaleItem no pueden sobregirar la cantidad vendida.
      for (const item of data.items) {
        const saleItem = sale.items.find((i) => i.id === item.saleItemId);
        if (!saleItem) throw new ValidationError(`El item ${item.saleItemId} no pertenece a la venta`);
        const already = alreadyReturnedByItem.get(item.saleItemId) ?? 0;
        if (already + item.quantity > Number(saleItem.quantity)) {
          throw new ValidationError(
            `La cantidad devuelta del producto ${saleItem.productId} (${already + item.quantity}) excede lo vendido (${Number(saleItem.quantity)})`
          );
        }
      }

      const created = await tx.return.create({
        data: {
          companyId,
          branchId: data.branchId,
          saleId: data.saleId,
          customerId: data.customerId,
          reason: data.reason,
          total: data.total,
          createdByUserId: data.createdByUserId,
          items: {
            create: data.items.map((item) => ({
              saleItemId: item.saleItemId,
              productId: item.productId,
              quantity: item.quantity,
              unitPrice: item.unitPrice,
              total: item.total,
              restockedToBranch: item.restockedToBranch,
            })),
          },
        },
        include: { items: true },
      });

      for (const item of data.items) {
        if (!item.restockedToBranch) continue;

        const product = await tx.product.findFirst({ where: { id: item.productId } });

        // Se reusa el costo real con el que salio en la venta (StockMovement SALE_OUT original),
        // no Product.currentCost actual -- puede haber cambiado desde entonces por compras
        // posteriores. Fallback a currentCost si no se encuentra (no deberia pasar para una
        // venta COMPLETED, defensivo).
        const originalSaleMovement = await tx.stockMovement.findFirst({
          where: { referenceType: "Sale", referenceId: data.saleId, productId: item.productId, type: "SALE_OUT" },
        });
        const unitCost = Number(originalSaleMovement?.unitCost ?? product?.currentCost ?? 0);

        await tx.productBranchStock.upsert({
          where: { productId_branchId: { productId: item.productId, branchId: data.branchId } },
          create: { companyId, productId: item.productId, branchId: data.branchId, quantity: item.quantity },
          update: { quantity: { increment: item.quantity } },
        });

        if (product?.tracksBatches) {
          // Lote nuevo, no se reinserta en el lote FIFO original consumido: SaleItem/StockMovement
          // no guardan a nivel de linea que lote especifico se consumio (limitacion ya
          // documentada en suppliers/README.md, punto 1 -- no se inventa esa trazabilidad aqui).
          await tx.batch.create({
            data: {
              companyId,
              productId: item.productId,
              branchId: data.branchId,
              batchNumber: `DEVOLUCION-${created.id}`,
              quantity: item.quantity,
              costAtEntry: unitCost,
            },
          });
        }

        const movement = await tx.stockMovement.create({
          data: {
            companyId,
            branchId: data.branchId,
            productId: item.productId,
            type: "RETURN_IN",
            quantity: item.quantity,
            unitCost,
            referenceType: "Return",
            referenceId: created.id,
            createdByUserId: data.createdByUserId,
          },
        });
        // Deliberadamente NO se actualiza Product.currentCost aqui: restaurar una devolucion al
        // mismo costo con el que salio no debe re-promediar el costo de productos no tocados.
        await recordKardexEntry(tx, { branchId: data.branchId, productId: item.productId, movementId: movement.id });
      }

      const finalReturnedByItem = new Map(alreadyReturnedByItem);
      for (const item of data.items) {
        finalReturnedByItem.set(item.saleItemId, (finalReturnedByItem.get(item.saleItemId) ?? 0) + item.quantity);
      }
      const allFullyReturned = sale.items.every((si) => (finalReturnedByItem.get(si.id) ?? 0) >= Number(si.quantity));
      const anyReturned = sale.items.some((si) => (finalReturnedByItem.get(si.id) ?? 0) > 0);
      const newStatus = allFullyReturned ? "RETURNED_FULL" : anyReturned ? "RETURNED_PARTIAL" : sale.status;
      if (newStatus !== sale.status) {
        await tx.sale.update({ where: { id: data.saleId }, data: { status: newStatus } });
      }

      return created;
    });

    return toRecord(row);
  }

  async list(filters: { saleId?: string; take?: number; skip?: number }): Promise<ReturnRecord[]> {
    const rows = await prisma.return.findMany({
      where: filters.saleId ? { saleId: filters.saleId } : undefined,
      include: { items: true },
      orderBy: { createdAt: "desc" },
      take: filters.take ?? 50,
      skip: filters.skip ?? 0,
    });
    return rows.map(toRecord);
  }
}
