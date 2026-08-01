import { getTenantContext } from "../../../../shared/context/request-context";

/**
 * Registra una fila de Kardex (historial de saldos) justo despues de crear un StockMovement,
 * dentro de la MISMA transaccion Prisma -- por eso recibe `tx` en vez de usar el cliente global
 * (mismo patron ya usado para efectos secundarios transaccionales en
 * `pos/sale/infrastructure/prisma-sale.repository.ts`, `applyCompletionSideEffects`).
 *
 * `averageCost` es una foto de `Product.currentCost` (costo promedio ponderado, unico por
 * empresa, no por sucursal) en el momento del movimiento -- no se recalcula un promedio nuevo
 * aqui. Para movimientos que no tocan `Product.currentCost` (entrada manual via
 * `registerEntry`, ajustes, traslados) la fila de Kardex simplemente refleja el costo que ya
 * habia en el producto, igual que el resto de la app ya asume en esos flujos.
 *
 * Debe llamarse DESPUES de que `ProductBranchStock.quantity` y (si aplica) `Product.currentCost`
 * ya quedaron actualizados en la transaccion, para que `balanceQty`/`averageCost` sean el saldo
 * resultante del movimiento, no el previo.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function recordKardexEntry(
  tx: any,
  params: { branchId: string; productId: string; movementId: string }
): Promise<void> {
  const companyId = getTenantContext().companyId;

  const [stock, product] = await Promise.all([
    tx.productBranchStock.findFirst({ where: { productId: params.productId, branchId: params.branchId } }),
    tx.product.findFirst({ where: { id: params.productId }, select: { currentCost: true } }),
  ]);

  const balanceQty = Number(stock?.quantity ?? 0);
  const averageCost = Number(product?.currentCost ?? 0);

  await tx.kardex.create({
    data: {
      companyId,
      branchId: params.branchId,
      productId: params.productId,
      movementId: params.movementId,
      balanceQty,
      balanceCost: balanceQty * averageCost,
      averageCost,
    },
  });
}
