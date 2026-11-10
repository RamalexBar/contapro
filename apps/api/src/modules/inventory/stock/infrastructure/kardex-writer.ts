import { getTenantContext } from "../../../../shared/context/request-context";
import { valueStock } from "../domain/fifo-cost";
import { listOpenLayers } from "./cost-layers";

/**
 * Registra una fila de Kardex (historial de saldos) justo despues de crear un StockMovement, dentro de la MISMA
 * transaccion Prisma (`tx`).
 *
 * Desde el costeo PEPS (2026-11-10) el saldo se valoriza con las capas reales que quedan en la sucursal
 * (`balanceCost` = suma de cantidad x costo de cada capa; lo que no tenga capa, al `Product.currentCost` vigente) y
 * `averageCost` es el costo unitario de ese saldo (balanceCost / balanceQty), no un promedio movil de la empresa.
 *
 * Debe llamarse DESPUES de actualizar ProductBranchStock y las capas en la transaccion, para que el saldo sea el
 * resultante del movimiento, no el previo.
 */
export async function recordKardexEntry(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  tx: any,
  params: { branchId: string; productId: string; movementId: string }
): Promise<void> {
  const companyId = getTenantContext().companyId;

  const [stock, product, layers] = await Promise.all([
    tx.productBranchStock.findFirst({ where: { productId: params.productId, branchId: params.branchId } }),
    tx.product.findFirst({ where: { id: params.productId }, select: { currentCost: true } }),
    listOpenLayers(tx, params.productId, params.branchId),
  ]);

  const balanceQty = Number(stock?.quantity ?? 0);
  const balanceCost = balanceQty > 0 ? valueStock(layers, balanceQty, Number(product?.currentCost ?? 0)) : 0;
  const averageCost = balanceQty > 0 ? balanceCost / balanceQty : Number(product?.currentCost ?? 0);

  await tx.kardex.create({
    data: {
      companyId,
      branchId: params.branchId,
      productId: params.productId,
      movementId: params.movementId,
      balanceQty,
      balanceCost: Math.round(balanceCost * 10000) / 10000,
      averageCost: Math.round(averageCost * 10000) / 10000,
    },
  });
}
