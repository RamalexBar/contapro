import { round2 } from "@erp/shared-utils";
import { Prisma } from "@erp/database";
import { prisma } from "../../../../shared/prisma/prisma-client";
import { getTenantContext } from "../../../../shared/context/request-context";
import { NotFoundError } from "../../../../shared/errors/app-error";
import type { CreateSaleData, ISaleRepository, SaleRecord } from "../domain/sale.repository";
import { recordKardexEntry } from "../../../inventory/stock/infrastructure/kardex-writer";
import { consumeCostLayers, refreshCurrentCost } from "../../../inventory/stock/infrastructure/cost-layers";
import { segmentsCost } from "../../../inventory/stock/domain/fifo-cost";

function toRecord(row: any, costTotal = 0): SaleRecord {
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
    retentionTotal: Number(row.retentionTotal),
    cufe: row.cufe,
    cude: row.cude,
    invoiceXmlUrl: row.invoiceXmlUrl,
    createdAt: row.createdAt,
    accountReceivableId: row.accountReceivable?.id ?? null,
    requestedReceivableDueDate: row.requestedReceivableDueDate ?? null,
    currency: row.currency,
    exchangeRate: Number(row.exchangeRate),
    foreignTotal: row.currency === "COP" ? null : round2(Number(row.total) / Number(row.exchangeRate)),
    priceListId: row.priceListId,
    withholdings: row.withholdings.map((w: any) => ({
      withholdingConceptId: w.withholdingConceptId,
      type: w.withholdingConcept.type,
      base: Number(w.base),
      ratePercent: Number(w.ratePercent),
      amount: Number(w.amount),
    })),
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
    costTotal,
  };
}

const SALE_INCLUDE = {
  items: true,
  payments: true,
  withholdings: { include: { withholdingConcept: { select: { type: true } } } },
  accountReceivable: { select: { id: true } },
} as const;

export class PrismaSaleRepository implements ISaleRepository {
  /**
   * Consecutivo real via BranchSaleCounter en vez del `count()+1` original -- ese calculo leia
   * el conteo de Sale y, bajo dos cajeros vendiendo en la misma sucursal casi al mismo instante,
   * ambas transacciones podian leer el mismo numero y una de las dos chocaba con
   * `Sale.@@unique([branchId, number])`, devolviendo un 500 (confirmado en vivo disparando 8
   * ventas en paralelo contra la misma sucursal: varias fallaron). El UPDATE con `increment` es
   * atomico a nivel de fila en Postgres -- dos transacciones concurrentes se serializan solas
   * (la segunda espera el lock de fila de la primera), asi que nunca pueden devolver el mismo
   * numero, sin necesidad de reintentos.
   */
  private async getNextSaleNumber(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    tx: any,
    companyId: string,
    branchId: string
  ): Promise<number> {
    try {
      const counter = await tx.branchSaleCounter.update({
        where: { companyId_branchId: { companyId, branchId } },
        data: { lastNumber: { increment: 1 } },
      });
      return counter.lastNumber;
    } catch (err) {
      if (!(err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2025")) throw err;
      // Primera venta de esta sucursal: la fila del contador todavia no existe. La sembramos con
      // el maximo Sale.number ya usado (0 si nunca vendio, para continuar donde iba el
      // count()+1 anterior sin chocar con ventas ya numeradas antes de este cambio).
      //
      // Bug real encontrado y corregido aqui: la primera version usaba create() + catch(P2002) +
      // otro update() de respaldo -- pero en Postgres, una violacion de unique constraint (el
      // create() chocando) ABORTA la transaccion completa, no solo esa sentencia. Cualquier query
      // posterior en el mismo tx (el update() de respaldo) fallaba con "current transaction is
      // aborted, commands ignored until end of transaction block" (confirmado en vivo disparando
      // 25 ventas en paralelo la primera vez que corria esta sucursal). upsert() en Postgres
      // compila a un solo INSERT ... ON CONFLICT DO UPDATE atomico -- nunca lanza un P2002 por
      // una carrera, asi que no hay una segunda sentencia que pueda heredar una transaccion ya
      // envenenada.
      const maxSale = await tx.sale.aggregate({ where: { branchId }, _max: { number: true } });
      const counter = await tx.branchSaleCounter.upsert({
        where: { companyId_branchId: { companyId, branchId } },
        create: { companyId, branchId, lastNumber: (maxSale._max.number ?? 0) + 1 },
        update: { lastNumber: { increment: 1 } },
      });
      return counter.lastNumber;
    }
  }

  async create(data: CreateSaleData): Promise<SaleRecord> {
    const companyId = getTenantContext().companyId;
    let costTotal = 0;

    const row = await prisma.$transaction(async (tx) => {
      const number = await this.getNextSaleNumber(tx, companyId, data.branchId);

      const sale = await tx.sale.create({
        data: {
          companyId,
          branchId: data.branchId,
          number,
          customerId: data.customerId,
          cashSessionId: data.cashSessionId,
          sellerUserId: data.sellerUserId,
          status: data.status,
          paymentStatus: data.paymentStatus,
          subtotal: data.subtotal,
          discountTotal: data.discountTotal,
          taxTotal: data.taxTotal,
          total: data.total,
          retentionTotal: data.retentionTotal,
          currency: data.currency,
          exchangeRate: data.exchangeRate,
          priceListId: data.priceListId,
          requestedReceivableDueDate: data.requestedReceivableDueDate,
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
          withholdings: {
            create: data.withholdings.map((w) => ({
              withholdingConceptId: w.withholdingConceptId,
              base: w.base,
              ratePercent: w.ratePercent,
              amount: w.amount,
            })),
          },
        },
        include: SALE_INCLUDE,
      });

      if (data.status === "COMPLETED") {
        costTotal = await this.applyCompletionSideEffects(tx, sale.id, data.branchId, data.cashSessionId, sale.items, sale.total, sale.sellerUserId);
      }

      // AccountReceivable (item 31, modulo `collections`) dentro de la MISMA transaccion que la
      // venta -- no dispara su propia contabilizacion, la venta ya contabilizo el monto CREDIT
      // como debito a "Clientes" en PostSaleJournalEntryUseCase; esto solo deja el registro
      // estructurado de quien debe, cuanto y para cuando.
      if (data.receivable) {
        await tx.accountReceivable.create({
          data: {
            companyId,
            customerId: data.receivable.customerId,
            saleId: sale.id,
            amount: data.receivable.amount,
            balance: data.receivable.amount,
            dueDate: data.receivable.dueDate,
          },
        });
        return tx.sale.findFirstOrThrow({ where: { id: sale.id }, include: SALE_INCLUDE });
      }

      return sale;
    });

    return toRecord(row, costTotal);
  }

  async findByIdOrThrow(id: string): Promise<SaleRecord> {
    const row = await prisma.sale.findFirst({ where: { id }, include: SALE_INCLUDE });
    if (!row) throw new NotFoundError("Sale", id);
    return toRecord(row);
  }

  async authorizeItemDiscount(saleId: string, saleItemId: string, discountAuthorizationId: string): Promise<SaleRecord> {
    let costTotal = 0;
    const row = await prisma.$transaction(async (tx) => {
      // Sale esta en TENANT_MODELS (auto-scoped por findFirst) -- se valida ANTES de tocar el
      // SaleItem, y se confirma que saleItemId realmente pertenece a esta venta. SaleItem no
      // tiene companyId propio, asi que sin esto un saleItemId de otra empresa se actualizaria
      // igual mientras el saleId propio fuera valido (defensa en profundidad: hoy el unico
      // caller, AuthorizeDiscountUseCase, ya valida esto por su cuenta, pero el repositorio no
      // deberia depender de que todo caller futuro repita la misma validacion).
      const sale = await tx.sale.findFirst({ where: { id: saleId }, include: SALE_INCLUDE });
      if (!sale) throw new NotFoundError("Sale", saleId);
      if (!sale.items.some((item) => item.id === saleItemId)) {
        throw new NotFoundError("SaleItem", saleItemId);
      }

      await tx.saleItem.update({
        where: { id: saleItemId },
        data: { requiresDiscountAuthorization: false, discountAuthorizationId },
      });

      const updatedSale = await tx.sale.findFirstOrThrow({ where: { id: saleId }, include: SALE_INCLUDE });
      const stillPending = updatedSale.items.some((item) => item.requiresDiscountAuthorization);
      if (!stillPending && updatedSale.status === "PENDING_AUTHORIZATION") {
        await tx.sale.update({ where: { id: saleId }, data: { status: "COMPLETED" } });
        costTotal = await this.applyCompletionSideEffects(
          tx,
          updatedSale.id,
          updatedSale.branchId,
          updatedSale.cashSessionId ?? undefined,
          updatedSale.items,
          updatedSale.total,
          updatedSale.sellerUserId
        );
        return tx.sale.findFirstOrThrow({ where: { id: saleId }, include: SALE_INCLUDE });
      }
      return updatedSale;
    });
    return toRecord(row, costTotal);
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

  async listForYear(year: number): Promise<SaleRecord[]> {
    const from = new Date(year, 0, 1);
    const to = new Date(year + 1, 0, 1);
    const rows = await prisma.sale.findMany({
      where: { status: { in: ["COMPLETED", "RETURNED_PARTIAL"] }, createdAt: { gte: from, lt: to } },
      include: SALE_INCLUDE,
      orderBy: { createdAt: "asc" },
    });
    return rows.map(toRecord);
  }

  async listForPeriod(year: number, month: number): Promise<SaleRecord[]> {
    const from = new Date(year, month - 1, 1);
    const to = new Date(year, month, 1);
    const rows = await prisma.sale.findMany({
      where: { status: { in: ["COMPLETED", "RETURNED_PARTIAL"] }, createdAt: { gte: from, lt: to } },
      include: SALE_INCLUDE,
      orderBy: { createdAt: "asc" },
    });
    return rows.map(toRecord);
  }

  /**
   * Efectos que solo deben ocurrir cuando una venta queda COMPLETED (de entrada, o al autorizarse el ultimo descuento
   * pendiente): descontar stock por sucursal, consumir las capas de costo PEPS (un StockMovement SALE_OUT por capa
   * tocada, con su costo real), guardar el costo real de cada linea en SaleItem.costTotal (base del reporte de
   * rentabilidad) y, si hay caja activa, un CashMovement SALE_IN. Devuelve el costo total de lo vendido para el asiento
   * de costo de venta (ver post-sale-journal-entry.use-case.ts).
   *
   * Lo que no alcanza a cubrir ninguna capa (venta sin existencias registradas) sale al Product.currentCost vigente, sin
   * bloquear la venta. No reversa el consumo si la venta se anula despues -- el modulo de Devoluciones es el que
   * devuelve mercancia (limitacion ya documentada de CancelSaleUseCase).
   */
  private async applyCompletionSideEffects(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    tx: any,
    saleId: string,
    branchId: string,
    cashSessionId: string | undefined | null,
    items: Array<{ id: string; productId: string; quantity: unknown; unitPrice: unknown }>,
    total: unknown,
    sellerUserId: string
  ): Promise<number> {
    const companyId = getTenantContext().companyId;
    let costTotal = 0;

    // Branch esta en TENANT_MODELS (auto-scoped por findFirst) -- se confirma ANTES de usar branchId en cualquier
    // where/create de abajo, para no dejar StockMovement/Kardex con una referencia a una sucursal ajena.
    const branch = await tx.branch.findFirst({ where: { id: branchId } });
    if (!branch) throw new NotFoundError("Branch", branchId);

    for (const item of items) {
      const quantity = Number(item.quantity);

      const product = await tx.product.findFirst({ where: { id: item.productId }, select: { id: true } });
      if (!product) throw new NotFoundError("Product", item.productId);

      const segments = await consumeCostLayers(tx, { productId: item.productId, branchId, quantity }, async (segment) => {
        await tx.productBranchStock.updateMany({
          where: { productId: item.productId, branchId },
          data: { quantity: { decrement: segment.quantity } },
        });
        const movement = await tx.stockMovement.create({
          data: {
            companyId,
            branchId,
            productId: item.productId,
            batchId: segment.layerId,
            type: "SALE_OUT",
            quantity: segment.quantity,
            unitCost: segment.unitCost,
            referenceType: "Sale",
            referenceId: saleId,
            createdByUserId: sellerUserId,
          },
        });
        await recordKardexEntry(tx, { branchId, productId: item.productId, movementId: movement.id });
      });
      await refreshCurrentCost(tx, item.productId);

      const lineCost = round2(segmentsCost(segments));
      costTotal += lineCost;
      // SaleItem no tiene companyId propio (se aisla por su Sale): el id viene de la venta recien leida en esta misma tx.
      await tx.saleItem.update({ where: { id: item.id }, data: { costTotal: lineCost } });
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

    return round2(costTotal);
  }
}
