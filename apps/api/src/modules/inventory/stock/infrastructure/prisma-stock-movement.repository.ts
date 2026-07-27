import { prisma } from "../../../../shared/prisma/prisma-client";
import { getTenantContext } from "../../../../shared/context/request-context";
import { ValidationError } from "../../../../shared/errors/app-error";
import type { IStockRepository, StockMovementRecord } from "../domain/stock.repository";

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

      await tx.stockMovement.createMany({
        data: [
          { companyId, branchId: fromBranchId, productId, type: "TRANSFER_OUT", quantity, unitCost, createdByUserId: userId },
          { companyId, branchId: toBranchId, productId, type: "TRANSFER_IN", quantity, unitCost, createdByUserId: userId },
        ],
      });
    });
  }

  async getBranchStock(productId: string, branchId: string) {
    const stock = await prisma.productBranchStock.findFirst({ where: { productId, branchId } });
    if (!stock) return null;
    return { quantity: Number(stock.quantity), minStock: Number(stock.minStock), maxStock: Number(stock.maxStock) };
  }
}
