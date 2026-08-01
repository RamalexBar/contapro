export interface KardexEntryRecord {
  id: string;
  branchId: string;
  productId: string;
  movementId: string;
  /** Del StockMovement referenciado (PURCHASE_IN, SALE_OUT, TRANSFER_IN/OUT, ADJUSTMENT_IN/OUT,
   * RETURN_IN/OUT) -- sin esto una fila de Kardex es solo un saldo sin contexto de que lo movio. */
  movementType: string;
  movementQuantity: number;
  balanceQty: number;
  balanceCost: number;
  averageCost: number;
  createdAt: Date;
}

export interface ListKardexFilter {
  productId: string;
  branchId?: string;
  from?: Date;
  to?: Date;
}

/** Kardex (historial de saldos): una fila por cada StockMovement, con el saldo resultante de
 * cantidad/costo/costo promedio en ese momento -- ver `infrastructure/kardex-writer.ts` para
 * como/cuando se genera cada fila. Solo lectura desde este puerto; la escritura ocurre dentro de
 * la misma transaccion Prisma que crea el StockMovement, no a traves de un caso de uso propio. */
export interface IKardexRepository {
  list(filter: ListKardexFilter): Promise<KardexEntryRecord[]>;
}
