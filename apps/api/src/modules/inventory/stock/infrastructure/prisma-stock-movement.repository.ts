import { prisma } from "../../../../shared/prisma/prisma-client";
import { getTenantContext } from "../../../../shared/context/request-context";
import { ValidationError } from "../../../../shared/errors/app-error";
import type { IStockRepository, ReceiveGoodsItem, StockMovementRecord } from "../domain/stock.repository";
import { recordKardexEntry } from "./kardex-writer";

function toRecord(row: {
  id: string;
  productId: string;
  branchId: string;
  type: string;
  quantity: unknown;
  unitCost: unknown;
  createdAt: Date;
}): StockMovementRecord {
  return {
    id: row.id,
    productId: row.productId,
    branchId: row.branchId,
    type: row.type,
    quantity: Number(row.quantity),
    unitCost: Number(row.unitCost),
    createdAt: row.createdAt,
  };
}

export class PrismaStockMovementRepository implements IStockRepository {
  async registerEntry(productId: string, branchId: string, quantity: number, unitCost: number, userId: string): Promise<StockMovementRecord> {
    const companyId = getTenantContext().companyId;
    return prisma.$transaction(async (tx) => {
      await tx.productBranchStock.upsert({
        where: { productId_branchId: { productId, branchId } },
        create: { companyId, productId, branchId, quantity },
        update: { quantity: { increment: quantity } },
      });
      const movement = await tx.stockMovement.create({
        data: { companyId, branchId, productId, type: "PURCHASE_IN", quantity, unitCost, createdByUserId: userId },
      });
      await recordKardexEntry(tx, { branchId, productId, movementId: movement.id });
      return toRecord(movement);
    });
  }

  async adjust(productId: string, branchId: string, quantityDelta: number, reason: string, userId: string): Promise<StockMovementRecord> {
    const companyId = getTenantContext().companyId;
    const type = quantityDelta >= 0 ? "ADJUSTMENT_IN" : "ADJUSTMENT_OUT";
    return prisma.$transaction(async (tx) => {
      const stock = await tx.productBranchStock.findFirst({ where: { productId, branchId } });
      const newQuantity = Number(stock?.quantity ?? 0) + quantityDelta;
      if (newQuantity < 0) throw new ValidationError("El ajuste dejaria el inventario en negativo");

      await tx.productBranchStock.upsert({
        where: { productId_branchId: { productId, branchId } },
        create: { companyId, productId, branchId, quantity: newQuantity },
        update: { quantity: newQuantity },
      });

      const product = await tx.product.findFirst({ where: { id: productId } });
      const movement = await tx.stockMovement.create({
        data: {
          companyId,
          branchId,
          productId,
          type,
          quantity: Math.abs(quantityDelta),
          unitCost: product?.currentCost ?? 0,
          referenceType: "ManualAdjustment",
          createdByUserId: userId,
        },
      });
      await recordKardexEntry(tx, { branchId, productId, movementId: movement.id });
      void reason; // el motivo se registra en AuditLog desde el caso de uso, no en StockMovement
      return toRecord(movement);
    });
  }

  async transfer(productId: string, fromBranchId: string, toBranchId: string, quantity: number, userId: string): Promise<void> {
    const companyId = getTenantContext().companyId;
    await prisma.$transaction(async (tx) => {
      const sourceStock = await tx.productBranchStock.findFirst({ where: { productId, branchId: fromBranchId } });
      if (!sourceStock || Number(sourceStock.quantity) < quantity) {
        throw new ValidationError("Stock insuficiente en la sucursal de origen");
      }

      await tx.productBranchStock.update({ where: { id: sourceStock.id }, data: { quantity: { decrement: quantity } } });
      await tx.productBranchStock.upsert({
        where: { productId_branchId: { productId, branchId: toBranchId } },
        create: { companyId, productId, branchId: toBranchId, quantity },
        update: { quantity: { increment: quantity } },
      });

      const product = await tx.product.findFirst({ where: { id: productId } });
      const unitCost = product?.currentCost ?? 0;

      await tx.stockTransfer.create({
        data: {
          companyId,
          fromBranchId,
          toBranchId,
          status: "RECEIVED",
          requestedByUserId: userId,
          receivedByUserId: userId,
          items: { create: [{ productId, quantity }] },
        },
      });

      // create() en vez de createMany() -- se necesita el id de cada movimiento para su fila de
      // Kardex correspondiente (createMany() de Prisma no devuelve los registros creados).
      const outMovement = await tx.stockMovement.create({
        data: { companyId, branchId: fromBranchId, productId, type: "TRANSFER_OUT", quantity, unitCost, createdByUserId: userId },
      });
      await recordKardexEntry(tx, { branchId: fromBranchId, productId, movementId: outMovement.id });

      const inMovement = await tx.stockMovement.create({
        data: { companyId, branchId: toBranchId, productId, type: "TRANSFER_IN", quantity, unitCost, createdByUserId: userId },
      });
      await recordKardexEntry(tx, { branchId: toBranchId, productId, movementId: inMovement.id });
    });
  }

  async getBranchStock(productId: string, branchId: string) {
    const stock = await prisma.productBranchStock.findFirst({ where: { productId, branchId } });
    if (!stock) return null;
    return { quantity: Number(stock.quantity), minStock: Number(stock.minStock), maxStock: Number(stock.maxStock) };
  }

  async receiveGoods(items: ReceiveGoodsItem[], referenceType: string, referenceId: string, userId: string): Promise<StockMovementRecord[]> {
    const companyId = getTenantContext().companyId;

    return prisma.$transaction(async (tx) => {
      const movements: StockMovementRecord[] = [];

      // Se procesa en secuencia (no Promise.all) para que, si el mismo producto aparece dos
      // veces en la misma recepcion (ej. dos lotes distintos), el promedio ponderado de la
      // segunda linea ya considere la cantidad/costo actualizados por la primera.
      for (const item of items) {
        const product = await tx.product.findFirstOrThrow({ where: { id: item.productId } });

        // Se lee ANTES de sumar la cantidad recibida, para poder ponderar el promedio contra las
        // existencias previas (en TODAS las sucursales -- Product.currentCost es un solo valor
        // por toda la empresa, no por sucursal).
        const priorTotal = await tx.productBranchStock.aggregate({
          where: { productId: item.productId },
          _sum: { quantity: true },
        });
        const priorQty = Number(priorTotal._sum.quantity ?? 0);

        await tx.productBranchStock.upsert({
          where: { productId_branchId: { productId: item.productId, branchId: item.branchId } },
          create: { companyId, productId: item.productId, branchId: item.branchId, quantity: item.quantity },
          update: { quantity: { increment: item.quantity } },
        });

        if (product.tracksBatches) {
          await tx.batch.create({
            data: {
              companyId,
              productId: item.productId,
              branchId: item.branchId,
              batchNumber: item.batchNumber ?? `LOTE-${Date.now()}`,
              expirationDate: item.expirationDate,
              quantity: item.quantity,
              costAtEntry: item.unitCost,
            },
          });
        }

        const movement = await tx.stockMovement.create({
          data: {
            companyId,
            branchId: item.branchId,
            productId: item.productId,
            type: "PURCHASE_IN",
            quantity: item.quantity,
            unitCost: item.unitCost,
            referenceType,
            referenceId,
            createdByUserId: userId,
          },
        });
        movements.push(toRecord(movement));

        // FIFO no tiene consumo real implementado todavia (ver README de suppliers) -- se calcula
        // igual que AVERAGE mientras tanto, en vez de inventar una formula sin verificar.
        const newCost =
          product.costMethod === "LAST"
            ? item.unitCost
            : priorQty + item.quantity > 0
              ? (priorQty * Number(product.currentCost) + item.quantity * item.unitCost) / (priorQty + item.quantity)
              : item.unitCost;

        await tx.product.update({ where: { id: item.productId }, data: { currentCost: newCost } });
        // Despues de actualizar currentCost, para que la fila de Kardex refleje el promedio
        // ponderado ya recalculado con esta entrada, no el anterior.
        await recordKardexEntry(tx, { branchId: item.branchId, productId: item.productId, movementId: movement.id });
      }

      return movements;
    });
  }
}
