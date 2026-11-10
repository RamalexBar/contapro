/**
 * Costeo PEPS (primero en entrar, primero en salir) -- funciones puras, sin Prisma.
 *
 * Cada entrada de mercancia crea una "capa" (Batch) con su cantidad y su costo unitario. Cada salida consume las capas
 * de la mas vieja a la mas nueva, asi la utilidad de una venta sale con el costo real de lo que fisicamente salio:
 * compro 10 bombones a $250 en enero y 10 a $300 en marzo -> las primeras 10 ventas cuestan $250 cada una y solo
 * despues empiezan a costar $300.
 */

export interface CostLayer {
  id: string;
  quantity: number;
  unitCost: number;
}

export interface CostSegment {
  /** null = parte de la salida que no tenia capa que la cubriera (se vendio sin existencias registradas). */
  layerId: string | null;
  quantity: number;
  unitCost: number;
}

const EPSILON = 1e-9;

/**
 * Reparte `quantity` entre las capas en el orden recibido (el llamador las pasa de la mas vieja a la mas nueva). Lo que
 * no alcanzan a cubrir las capas sale como un ultimo segmento sin capa, valorizado a `fallbackCost` (el costo vigente
 * del producto) -- la venta no se bloquea por eso, igual que antes de PEPS.
 */
export function allocateFifo(layers: CostLayer[], quantity: number, fallbackCost: number): CostSegment[] {
  const segments: CostSegment[] = [];
  let remaining = quantity;
  for (const layer of layers) {
    if (remaining <= EPSILON) break;
    if (layer.quantity <= EPSILON) continue;
    const take = Math.min(remaining, layer.quantity);
    segments.push({ layerId: layer.id, quantity: take, unitCost: layer.unitCost });
    remaining -= take;
  }
  if (remaining > EPSILON) segments.push({ layerId: null, quantity: remaining, unitCost: fallbackCost });
  return segments;
}

/**
 * Cuantas unidades de una entrada nueva deben quedar como capa. Normalmente todas; pero si la sucursal venia en negativo
 * (se vendio sin existencias, esas unidades ya salieron costeadas al costo vigente) la entrada primero tapa ese hueco y
 * solo el resto queda como capa. Asi la suma de las capas nunca supera las existencias reales.
 *
 * @param stockAfter existencias de la sucursal YA sumada la entrada
 * @param layersBefore unidades que ya estaban cubiertas por capas antes de la entrada
 */
export function layerQuantityForEntry(incoming: number, stockAfter: number, layersBefore: number): number {
  const uncovered = stockAfter - layersBefore;
  const qty = Math.min(incoming, uncovered);
  return qty > EPSILON ? qty : 0;
}

/**
 * Valor del saldo de una sucursal: lo cubierto por capas a su costo real, mas lo que no tiene capa (desfase heredado)
 * al costo vigente.
 */
export function valueStock(layers: CostLayer[], stockQty: number, fallbackCost: number): number {
  let layered = 0;
  let value = 0;
  for (const layer of layers) {
    if (layer.quantity <= EPSILON) continue;
    layered += layer.quantity;
    value += layer.quantity * layer.unitCost;
  }
  const uncovered = stockQty - layered;
  if (uncovered > EPSILON) value += uncovered * fallbackCost;
  return value;
}

/** Costo total de unos segmentos (para el asiento de costo de venta y SaleItem.costTotal). */
export function segmentsCost(segments: CostSegment[]): number {
  return segments.reduce((sum, s) => sum + s.quantity * s.unitCost, 0);
}
