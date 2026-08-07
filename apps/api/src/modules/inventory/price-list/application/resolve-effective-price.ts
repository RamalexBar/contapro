import type { IPriceListRepository } from "../domain/price-list.repository";

/**
 * Precio efectivo de un producto (item 35 de docs/ALCANCE.md): si hay una lista de precios
 * efectiva y esta tiene un override para el producto, se usa ese; si no, el precio base
 * (Product.currentPrice, ya resuelto por el caller antes de invocar esto).
 */
export async function resolveEffectivePrice(
  priceListRepo: IPriceListRepository,
  priceListId: string | null,
  productId: string,
  basePrice: number
): Promise<number> {
  if (!priceListId) return basePrice;
  const override = await priceListRepo.findProductPrice(priceListId, productId);
  return override ?? basePrice;
}
