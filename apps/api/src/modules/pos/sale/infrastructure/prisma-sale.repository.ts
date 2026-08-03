import { prisma } from "../../../../shared/prisma/prisma-client";
import { getTenantContext } from "../../../../shared/context/request-context";
import { NotFoundError } from "../../../../shared/errors/app-error";
import type { CreateSaleData, ISaleRepository, SaleRecord } from "../domain/sale.repository";
import { recordKardexEntry } from "../../../inventory/stock/infrastructure/kardex-writer";

function toRecord(row: any): SaleRecord {
  return {
    id: row.id,
    companyId: row.companyId,
    branchId: row.branchId,
    number: row.number,
    customerId: row.customerId,
    sellerUserId: row.sellerUserId,
    status: row.status,
    paymentStatus: row.paymentStatus,
    subtotal: Number(row.subtotal),
    discountTotal: Number(row.discountTotal),
    taxTotal: Number(row.taxTotal),
    total: Number(row.total),
    cufe: row.cufe,
    cude: row.cude,
    invoiceXmlUrl: row.invoiceXmlUrl,
    createdAt: row.createdAt,
    items: row.items.map((item: any) => ({
      id: item.id,
      productId: item.productId,
      quantity: Number(item.quantity),
      unitPrice: Number(item.unitPrice),
      discountPercent: Number(item.discountPercent),
      taxPercent: Number(item.taxPercent),
      taxAmount: Number(item.taxAmount),
      total: Number(item.total),
      requiresDiscountAuthorization: item.requiresDiscountAuthorization,
      discountAuthorizationId: item.discountAuthorizationId,
    })),
    payments: row.payments.map((p: any) => ({ method: p.method, amount: Number(p.amount) })),
  };
}

const SALE_INCLUDE = { items: true, payments: true } as const;

export class PrismaSaleRepository implements ISaleRepository {
  async create(data: CreateSaleData): Promise<SaleRecord> {
    const companyId = getTenantContext().companyId;

    const row = await prisma.$transaction(async (tx) => {
      // NOTA: consecutivo simple por conteo. Para alta concurrencia real se recomienda una
      // secuencia dedicada por sucursal (fase 2); aceptable para el volumen de un POS pequeño.
      const count = await tx.sale.count({ where: { branchId: data.branchId } });

      const sale = await tx.sale.create({
        data: {
          companyId,
          branchId: data.branchId,
          number: count + 1,
          customerId: data.customerId,
          cashSessionId: data.cashSessionId,
          sellerUserId: data.sellerUserId,
          status: data.status,
          paymentStatus: data.paymentStatus,
          subtotal: data.subtotal,
          discountTotal: data.discountTotal,
          taxTotal: data.taxTotal,
          total: data.total,
          items: {
            create: data.items.map((item) => ({
              productId: item.productId,
              quantity: item.quantity,
              unitPrice: item.unitPrice,
              discountPercent: item.discountPercent,
              discountAmount: item.discountAmount,
              taxPercent: item.taxPercent,
              taxAmount: item.taxAmount,
              total: item.total,
              requiresDiscountAuthorization: item.requiresDiscountAuthorization,
            })),
          },
          payments: {
            create: data.payments.map((p) => ({ method: p.method, amount: p.amount, reference: p.reference })),
          },
        },
        include: SALE_INCLUDE,
      });

      if (data.status === "COMPLETED") {
        await this.applyCompletionSideEffects(tx, sale.id, data.branchId, data.cashSessionId, sale.items, sale.total, sale.sellerUserId);
      }

      return sale;
    });

    return toRecord(row);
  }

  async findByIdOrThrow(id: string): Promise<SaleRecord> {
    const row = await prisma.sale.findFirst({ where: { id }, include: SALE_INCLUDE });
    if (!row) throw new NotFoundError("Sale", id);
    return toRecord(row);
  }

  async authorizeItemDiscount(saleId: string, saleItemId: string, discountAuthorizationId: string): Promise<SaleRecord> {
    const row = await prisma.$transaction(async (tx) => {
      await tx.saleItem.update({
        where: { id: saleItemId },
        data: { requiresDiscountAuthorization: false, discountAuthorizationId },
      });

      const sale = await tx.sale.findFirst({ where: { id: saleId }, include: SALE_INCLUDE });
      if (!sale) throw new NotFoundError("Sale", saleId);

      const stillPending = sale.items.some((item) => item.requiresDiscountAuthorization);
      if (!stillPending && sale.status === "PENDING_AUTHORIZATION") {
        await tx.sale.update({ where: { id: saleId }, data: { status: "COMPLETED" } });
        await this.applyCompletionSideEffects(tx, sale.id, sale.branchId, sale.cashSessionId ?? undefined, sale.items, sale.total, sale.sellerUserId);
        return tx.sale.findFirstOrThrow({ where: { id: saleId }, include: SALE_INCLUDE });
      }
      return sale;
    });
    return toRecord(row);
  }

  async cancel(id: string, reason: string): Promise<SaleRecord> {
    const existing = await prisma.sale.findFirst({ where: { id } });
    if (!existing) throw new NotFoundError("Sale", id);
    const row = await prisma.sale.update({
      where: { id },
      data: { status: "CANCELLED", cancelReason: reason, cancelledAt: new Date() },
      include: SALE_INCLUDE,
    });
    return toRecord(row);
  }

  async list(filters: { take?: number; skip?: number }): Promise<SaleRecord[]> {
    const rows = await prisma.sale.findMany({
      include: SALE_INCLUDE,
      orderBy: { createdAt: "desc" },
      take: filters.take ?? 50,
      skip: filters.skip ?? 0,
    });
    return rows.map(toRecord);
  }

  /**
   * Efectos que solo deben ocurrir cuando una venta queda COMPLETED (de entrada, o al
   * autorizarse el ultimo descuento pendiente): descontar stock por sucursal, registrar
   * StockMovement SALE_OUT y, si hay caja activa, un CashMovement de tipo SALE_IN.
   */
  private async applyCompletionSideEffects(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    tx: any,
    saleId: string,
    branchId: string,
    cashSessionId: string | undefined | null,
    items: Array<{ productId: string; quantity: unknown; unitPrice: unknown }>,
    total: unknown,
    sellerUserId: string
  ): Promise<void> {
    const companyId = getTenantContext().companyId;

    for (const item of items) {
      const quantity = Number(item.quantity);

      const product = await tx.product.findFirst({
        where: { id: item.productId },
        select: { costMethod: true, tracksBatches: true, currentCost: true },
      });
      const useFifo = product?.costMethod === "FIFO" && product?.tracksBatches;

      // Bajo FIFO se genera una linea de StockMovement (y su Kardex) POR LOTE realmente
      // consumido, no una sola linea agregada por item -- para trazabilidad fina (que lote
      // exacto salio en esta venta). Sin FIFO/tracksBatches, un solo segmento igual que antes.
      const segments = useFifo
        ? await this.consumeFifoBatches(tx, item.productId, branchId, quantity, Number(product.currentCost))
        : [{ batchId: null, quantity, unitCost: Number(item.unitPrice) }];

      for (const segment of segments) {
        await tx.productBranchStock.updateMany({
          where: { productId: item.productId, branchId },
          data: { quantity: { decrement: segment.quantity } },
        });
        const movement = await tx.stockMovement.create({
          data: {
            companyId,
            branchId,
            productId: item.productId,
            batchId: segment.batchId,
            type: "SALE_OUT",
            quantity: segment.quantity,
            unitCost: segment.unitCost,
            referenceType: "Sale",
            referenceId: saleId,
            createdByUserId: sellerUserId,
          },
        });
        await recordKardexEntry(tx, { branchId, productId: item.productId, movementId: movement.id });
      }
    }

    if (cashSessionId) {
      await tx.cashMovement.create({
        data: {
          cashSessionId,
          type: "SALE_IN",
          amount: total,
          concept: `Venta #${saleId}`,
          referenceType: "Sale",
          referenceId: saleId,
          createdByUserId: sellerUserId,
        },
      });
    }
  }

  /**
   * Consumo FIFO real: agota los Batch del producto/sucursal en orden de entrada (`createdAt`
   * asc) hasta cubrir `quantity`, devolviendo un segmento por cada lote realmente consumido (con
   * su `batchId` y el costo real de ESE lote, `costAtEntry`) -- antes se devolvia un solo costo
   * unitario ponderado y el llamador creaba una unica linea de StockMovement por item de venta,
   * sin importar cuantos lotes distintos se hubieran tocado; ahora cada segmento se convierte en
   * su propia linea de StockMovement (ver `applyCompletionSideEffects`), para trazabilidad fina
   * de que lote exacto salio en la venta (iteracion 23, ver `suppliers/README.md` punto 1).
   *
   * Actualiza Product.currentCost al costo del lote mas antiguo que quede disponible tras el
   * consumo (el "proximo costo a vender" bajo FIFO), sin tocarlo si no queda ninguno.
   *
   * Si Batch no alcanza a cubrir toda la cantidad (drift frente a ProductBranchStock por ajustes
   * o transferencias que no tocan Batch -- ver limitacion ya documentada en el modulo de
   * inventario), el remanente se devuelve como un segmento con `batchId: null` valorado al ultimo
   * currentCost conocido, en vez de bloquear la venta. No reversa el consumo si la venta se anula
   * despues -- ver limitacion ya documentada de CancelSaleUseCase (el modulo de Devoluciones es
   * el que ajusta stock).
   */
  private async consumeFifoBatches(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    tx: any,
    productId: string,
    branchId: string,
    quantity: number,
    fallbackCost: number
  ): Promise<Array<{ batchId: string | null; quantity: number; unitCost: number }>> {
    const batches = await tx.batch.findMany({
      where: { productId, branchId, quantity: { gt: 0 } },
      orderBy: { createdAt: "asc" },
    });

    const segments: Array<{ batchId: string | null; quantity: number; unitCost: number }> = [];
    let remaining = quantity;
    for (const batch of batches) {
      if (remaining <= 0) break;
      const batchQty = Number(batch.quantity);
      const consumeQty = Math.min(remaining, batchQty);
      await tx.batch.update({ where: { id: batch.id }, data: { quantity: { decrement: consumeQty } } });
      segments.push({ batchId: batch.id, quantity: consumeQty, unitCost: Number(batch.costAtEntry) });
      remaining -= consumeQty;
    }

    if (remaining > 0) {
      segments.push({ batchId: null, quantity: remaining, unitCost: fallbackCost });
    }

    const nextBatch = await tx.batch.findFirst({
      where: { productId, branchId, quantity: { gt: 0 } },
      orderBy: { createdAt: "asc" },
    });
    if (nextBatch) {
      await tx.product.update({ where: { id: productId }, data: { currentCost: nextBatch.costAtEntry } });
    }

    return segments;
  }
}
