import { getTenantContext } from "../../../../shared/context/request-context";
import { allocateFifo, layerQuantityForEntry, type CostLayer, type CostSegment } from "../domain/fifo-cost";

/**
 * Capas de costo PEPS sobre la tabla Batch, siempre dentro de la transaccion Prisma del movimiento (`tx`). Es el UNICO
 * lugar que crea o consume capas: compras, entradas manuales, ajustes, traslados, ventas y devoluciones pasan por aqui,
 * para que el saldo valorizado y el costo de cada salida salgan siempre de la misma regla (ver domain/fifo-cost.ts).
 */

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Tx = any;

function toLayer(row: { id: string; quantity: unknown; costAtEntry: unknown }): CostLayer {
  return { id: row.id, quantity: Number(row.quantity), unitCost: Number(row.costAtEntry) };
}

/** Capas con saldo de un producto en una sucursal, de la mas vieja a la mas nueva. */
export async function listOpenLayers(tx: Tx, productId: string, branchId: string): Promise<CostLayer[]> {
  const rows = await tx.batch.findMany({
    where: { productId, branchId, quantity: { gt: 0 } },
    orderBy: [{ createdAt: "asc" }, { id: "asc" }],
    select: { id: true, quantity: true, costAtEntry: true },
  });
  return rows.map(toLayer);
}

/**
 * Registra la capa de una entrada. Llamar DESPUES de sumar la cantidad en ProductBranchStock (necesita las existencias
 * resultantes para no crear capa sobre unidades que ya se habian vendido en negativo, ver `layerQuantityForEntry`).
 *
 * `createdAt` permite ubicar la capa en el pasado: un traslado conserva la antiguedad de lo que salio de la otra
 * sucursal, y una devolucion de cliente vuelve con la antiguedad de la capa de donde salio.
 */
export async function addCostLayer(
  tx: Tx,
  params: {
    productId: string;
    branchId: string;
    quantity: number;
    unitCost: number;
    batchNumber?: string;
    expirationDate?: Date | null;
    createdAt?: Date;
  }
): Promise<string | null> {
  const companyId = getTenantContext().companyId;
  const [stock, layers] = await Promise.all([
    tx.productBranchStock.findFirst({ where: { productId: params.productId, branchId: params.branchId } }),
    // aggregate no lo cubre la extension de tenant: companyId explicito.
    tx.batch.aggregate({
      where: { companyId, productId: params.productId, branchId: params.branchId, quantity: { gt: 0 } },
      _sum: { quantity: true },
    }),
  ]);
  const quantity = layerQuantityForEntry(params.quantity, Number(stock?.quantity ?? 0), Number(layers._sum.quantity ?? 0));
  if (quantity <= 0) return null;

  const batch = await tx.batch.create({
    data: {
      companyId,
      productId: params.productId,
      branchId: params.branchId,
      batchNumber: params.batchNumber ?? `CAPA-${Date.now()}`,
      expirationDate: params.expirationDate ?? null,
      quantity,
      costAtEntry: params.unitCost,
      ...(params.createdAt ? { createdAt: params.createdAt } : {}),
    },
  });
  return batch.id;
}

/**
 * Consume `quantity` de las capas (de la mas vieja a la mas nueva) y devuelve un segmento por capa tocada, con su costo
 * real. Lo que no alcanza a cubrir ninguna capa sale al `Product.currentCost` vigente (segmento con layerId null).
 *
 * `preferUnitCost`: para devolver mercancia a un proveedor -- se sacan primero las capas que entraron a ese mismo
 * costo (las mas nuevas primero, normalmente la compra que se esta devolviendo) y despues el resto en orden PEPS.
 */
export async function consumeCostLayers(
  tx: Tx,
  params: { productId: string; branchId: string; quantity: number; preferUnitCost?: number },
  /** Se llama despues de descontar cada capa y antes de la siguiente: ahi el llamador descuenta las existencias de ese
   * segmento y crea su StockMovement + Kardex, asi cada fila del kardex muestra el saldo intermedio correcto. */
  afterEach?: (segment: CostSegment) => Promise<void>
): Promise<CostSegment[]> {
  const product = await tx.product.findFirst({ where: { id: params.productId }, select: { currentCost: true } });
  let layers = await listOpenLayers(tx, params.productId, params.branchId);
  if (params.preferUnitCost !== undefined) {
    const target = params.preferUnitCost;
    const matching = layers.filter((l) => Math.abs(l.unitCost - target) < 0.0001).reverse();
    layers = [...matching, ...layers.filter((l) => Math.abs(l.unitCost - target) >= 0.0001)];
  }

  const segments = allocateFifo(layers, params.quantity, Number(product?.currentCost ?? 0));
  for (const segment of segments) {
    if (segment.layerId) {
      await tx.batch.update({ where: { id: segment.layerId }, data: { quantity: { decrement: segment.quantity } } });
    }
    if (afterEach) await afterEach(segment);
  }
  return segments;
}

/**
 * Deja `Product.currentCost` en el costo de la capa mas vieja con saldo en cualquier sucursal: el costo al que va a
 * salir la proxima unidad. Si no queda ninguna capa se deja como estaba (ultimo costo conocido).
 */
export async function refreshCurrentCost(tx: Tx, productId: string): Promise<void> {
  const oldest = await tx.batch.findFirst({
    where: { productId, quantity: { gt: 0 } },
    orderBy: [{ createdAt: "asc" }, { id: "asc" }],
    select: { costAtEntry: true },
  });
  if (oldest) await tx.product.update({ where: { id: productId }, data: { currentCost: oldest.costAtEntry } });
}

/** Fecha de entrada de una capa (para que un traslado o una devolucion conserve su antiguedad). */
export async function layerCreatedAt(tx: Tx, layerId: string | null): Promise<Date | undefined> {
  if (!layerId) return undefined;
  const row = await tx.batch.findFirst({ where: { id: layerId }, select: { createdAt: true } });
  return row?.createdAt ?? undefined;
}
