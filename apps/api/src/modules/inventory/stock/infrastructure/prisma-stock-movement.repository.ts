import { prisma } from "../../../../shared/prisma/prisma-client";
import { getTenantContext } from "../../../../shared/context/request-context";
import { ValidationError } from "../../../../shared/errors/app-error";
import type { IStockRepository, ReceiveGoodsItem, StockMovementRecord } from "../domain/stock.repository";
import { recordKardexEntry } from "./kardex-writer";
import { addCostLayer, consumeCostLayers, layerCreatedAt, refreshCurrentCost } from "./cost-layers";

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

/**
 * Movimientos de inventario con costeo PEPS (2026-11-10): toda entrada crea una capa de costo (ver cost-layers.ts) y
 * toda salida consume las capas mas viejas primero, con un StockMovement por capa tocada para que el kardex muestre el
 * costo real de cada unidad que salio.
 */
export class PrismaStockMovementRepository implements IStockRepository {
  async registerEntry(productId: string, branchId: string, quantity: number, unitCost: number, userId: string): Promise<StockMovementRecord> {
    const companyId = getTenantContext().companyId;
    return prisma.$transaction(async (tx) => {
      await tx.productBranchStock.upsert({
        where: { productId_branchId: { productId, branchId } },
        create: { companyId, productId, branchId, quantity },
        update: { quantity: { increment: quantity } },
      });
      const batchId = await addCostLayer(tx, { productId, branchId, quantity, unitCost, batchNumber: `ENTRADA-${Date.now()}` });
      await refreshCurrentCost(tx, productId);
      const movement = await tx.stockMovement.create({
        data: { companyId, branchId, productId, batchId, type: "PURCHASE_IN", quantity, unitCost, createdByUserId: userId },
      });
      await recordKardexEntry(tx, { branchId, productId, movementId: movement.id });
      return toRecord(movement);
    });
  }

  async adjust(productId: string, branchId: string, quantityDelta: number, reason: string, userId: string): Promise<StockMovementRecord> {
    const companyId = getTenantContext().companyId;
    return prisma.$transaction(async (tx) => {
      const stock = await tx.productBranchStock.findFirst({ where: { productId, branchId } });
      const newQuantity = Number(stock?.quantity ?? 0) + quantityDelta;
      if (newQuantity < 0) throw new ValidationError("El ajuste dejaria el inventario en negativo");

      const product = await tx.product.findFirst({ where: { id: productId } });
      const currentCost = Number(product?.currentCost ?? 0);
      let first: StockMovementRecord | null = null;
      const recordMovement = async (segment: { layerId: string | null; quantity: number; unitCost: number }) => {
        const movement = await tx.stockMovement.create({
          data: {
            companyId,
            branchId,
            productId,
            batchId: segment.layerId,
            type: quantityDelta >= 0 ? "ADJUSTMENT_IN" : "ADJUSTMENT_OUT",
            quantity: segment.quantity,
            unitCost: segment.unitCost,
            referenceType: "ManualAdjustment",
            createdByUserId: userId,
          },
        });
        await recordKardexEntry(tx, { branchId, productId, movementId: movement.id });
        first ??= toRecord(movement);
      };

      if (quantityDelta >= 0) {
        // Sobrante: entra como capa nueva al costo vigente (el de la proxima unidad a salir).
        await tx.productBranchStock.upsert({
          where: { productId_branchId: { productId, branchId } },
          create: { companyId, productId, branchId, quantity: newQuantity },
          update: { quantity: newQuantity },
        });
        const layerId = await addCostLayer(tx, { productId, branchId, quantity: quantityDelta, unitCost: currentCost, batchNumber: `AJUSTE-${Date.now()}` });
        await recordMovement({ layerId, quantity: quantityDelta, unitCost: currentCost });
      } else {
        // Faltante: sale de las capas mas viejas, a su costo real (stock ya existe: newQuantity >= 0 lo garantiza).
        await consumeCostLayers(tx, { productId, branchId, quantity: Math.abs(quantityDelta) }, async (segment) => {
          await tx.productBranchStock.updateMany({ where: { productId, branchId }, data: { quantity: { decrement: segment.quantity } } });
          await recordMovement(segment);
        });
      }
      await refreshCurrentCost(tx, productId);
      void reason; // el motivo se registra en AuditLog desde el caso de uso, no en StockMovement
      if (!first) throw new ValidationError("El ajuste debe tener una cantidad distinta de cero");
      return first;
    });
  }

  async transfer(productId: string, fromBranchId: string, toBranchId: string, quantity: number, userId: string): Promise<void> {
    const companyId = getTenantContext().companyId;
    await prisma.$transaction(async (tx) => {
      const sourceStock = await tx.productBranchStock.findFirst({ where: { productId, branchId: fromBranchId } });
      if (!sourceStock || Number(sourceStock.quantity) < quantity) {
        throw new ValidationError("Stock insuficiente en la sucursal de origen");
      }

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

      // Lo que sale de las capas viejas del origen llega al destino con el MISMO costo y la misma antiguedad: trasladar
      // no cambia el orden en que se vende ni el costo de la mercancia.
      await consumeCostLayers(tx, { productId, branchId: fromBranchId, quantity }, async (segment) => {
        await tx.productBranchStock.update({ where: { id: sourceStock.id }, data: { quantity: { decrement: segment.quantity } } });
        await tx.productBranchStock.upsert({
          where: { productId_branchId: { productId, branchId: toBranchId } },
          create: { companyId, productId, branchId: toBranchId, quantity: segment.quantity },
          update: { quantity: { increment: segment.quantity } },
        });

        const outMovement = await tx.stockMovement.create({
          data: {
            companyId,
            branchId: fromBranchId,
            productId,
            batchId: segment.layerId,
            type: "TRANSFER_OUT",
            quantity: segment.quantity,
            unitCost: segment.unitCost,
            createdByUserId: userId,
          },
        });
        await recordKardexEntry(tx, { branchId: fromBranchId, productId, movementId: outMovement.id });

        const inLayerId = await addCostLayer(tx, {
          productId,
          branchId: toBranchId,
          quantity: segment.quantity,
          unitCost: segment.unitCost,
          batchNumber: `TRASLADO-${Date.now()}`,
          createdAt: await layerCreatedAt(tx, segment.layerId),
        });
        const inMovement = await tx.stockMovement.create({
          data: {
            companyId,
            branchId: toBranchId,
            productId,
            batchId: inLayerId,
            type: "TRANSFER_IN",
            quantity: segment.quantity,
            unitCost: segment.unitCost,
            createdByUserId: userId,
          },
        });
        await recordKardexEntry(tx, { branchId: toBranchId, productId, movementId: inMovement.id });
      });
    });
  }

  async getBranchStock(productId: string, branchId: string) {
    const stock = await prisma.productBranchStock.findFirst({ where: { productId, branchId } });
    if (!stock) return null;
    return { quantity: Number(stock.quantity), minStock: Number(stock.minStock), maxStock: Number(stock.maxStock) };
  }

  async listBranchStock(branchId: string) {
    const rows = await prisma.productBranchStock.findMany({ where: { branchId } });
    return rows.map((row) => ({
      productId: row.productId,
      quantity: Number(row.quantity),
      minStock: Number(row.minStock),
      maxStock: Number(row.maxStock),
    }));
  }

  async receiveGoods(items: ReceiveGoodsItem[], referenceType: string, referenceId: string, userId: string): Promise<StockMovementRecord[]> {
    const companyId = getTenantContext().companyId;

    return prisma.$transaction(async (tx) => {
      const movements: StockMovementRecord[] = [];

      // En secuencia (no Promise.all): si el mismo producto viene dos veces en la recepcion, cada linea es su propia capa.
      for (const item of items) {
        await tx.product.findFirstOrThrow({ where: { id: item.productId } });

        await tx.productBranchStock.upsert({
          where: { productId_branchId: { productId: item.productId, branchId: item.branchId } },
          create: { companyId, productId: item.productId, branchId: item.branchId, quantity: item.quantity },
          update: { quantity: { increment: item.quantity } },
        });

        // Siempre una capa, maneje o no el producto lotes: es lo que permite vender primero lo que entro antes y
        // calcular la utilidad con su costo real.
        const batchId = await addCostLayer(tx, {
          productId: item.productId,
          branchId: item.branchId,
          quantity: item.quantity,
          unitCost: item.unitCost,
          batchNumber: item.batchNumber ?? `LOTE-${Date.now()}`,
          expirationDate: item.expirationDate,
        });
        await refreshCurrentCost(tx, item.productId);

        const movement = await tx.stockMovement.create({
          data: {
            companyId,
            branchId: item.branchId,
            productId: item.productId,
            batchId,
            type: "PURCHASE_IN",
            quantity: item.quantity,
            unitCost: item.unitCost,
            referenceType,
            referenceId,
            createdByUserId: userId,
          },
        });
        movements.push(toRecord(movement));
        await recordKardexEntry(tx, { branchId: item.branchId, productId: item.productId, movementId: movement.id });
      }

      return movements;
    });
  }

  async returnGoods(items: ReceiveGoodsItem[], referenceType: string, referenceId: string, userId: string): Promise<StockMovementRecord[]> {
    const companyId = getTenantContext().companyId;

    return prisma.$transaction(async (tx) => {
      const movements: StockMovementRecord[] = [];

      for (const item of items) {
        const product = await tx.product.findFirstOrThrow({ where: { id: item.productId } });
        const stock = await tx.productBranchStock.findFirst({ where: { productId: item.productId, branchId: item.branchId } });
        const available = Number(stock?.quantity ?? 0);
        if (!stock || available < item.quantity) {
          // Se lanza dentro de la transaccion: ninguna linea se devuelve si una no alcanza.
          throw new ValidationError(
            `No se puede devolver ${item.quantity} de "${product.name}": solo quedan ${available} en inventario (ya se vendio o se movio parte de lo comprado)`
          );
        }

        // Sale primero de las capas que entraron a este mismo costo (la compra que se anula), despues en orden PEPS.
        const consume = { productId: item.productId, branchId: item.branchId, quantity: item.quantity, preferUnitCost: item.unitCost };
        await consumeCostLayers(tx, consume, async (segment) => {
          await tx.productBranchStock.update({ where: { id: stock.id }, data: { quantity: { decrement: segment.quantity } } });
          const movement = await tx.stockMovement.create({
            data: {
              companyId,
              branchId: item.branchId,
              productId: item.productId,
              batchId: segment.layerId,
              type: "RETURN_OUT",
              quantity: segment.quantity,
              // El costo de la compra que se reversa (el mismo con el que se reversa el asiento contable).
              unitCost: item.unitCost,
              referenceType,
              referenceId,
              createdByUserId: userId,
            },
          });
          movements.push(toRecord(movement));
          await recordKardexEntry(tx, { branchId: item.branchId, productId: item.productId, movementId: movement.id });
        });
        await refreshCurrentCost(tx, item.productId);
      }

      return movements;
    });
  }
}
