import { ValidationError } from "../../../../shared/errors/app-error";
import type { ICustomerRepository } from "../../../customers/domain/customer.repository";
import type { IPriceListRepository } from "../domain/price-list.repository";

/**
 * Resuelve que lista de precios aplica a una venta/cotizacion (item 35 de docs/ALCANCE.md):
 * `explicitPriceListId` (el cajero fuerza una lista para esa venta puntual) gana sobre la lista
 * asignada al cliente; sin ninguna de las dos, null (precio base). Si se resuelve una lista (por
 * cualquiera de los dos caminos), se valida que exista, pertenezca al tenant (findByIdOrThrow ya
 * queda auto-scopeado, ver tenant.extension.ts) y este activa -- mismo criterio que
 * CreateJournalEntryUseCase valida un costCenterId (item 34).
 */
export async function resolveEffectivePriceListId(
  customerRepo: ICustomerRepository,
  priceListRepo: IPriceListRepository,
  explicitPriceListId: string | undefined,
  customerId: string | undefined
): Promise<string | null> {
  let priceListId = explicitPriceListId;
  if (!priceListId && customerId) {
    const customer = await customerRepo.findByIdOrThrow(customerId);
    priceListId = customer.priceListId ?? undefined;
  }
  if (!priceListId) return null;

  const priceList = await priceListRepo.findByIdOrThrow(priceListId);
  if (!priceList.isActive) {
    throw new ValidationError(`La lista de precios ${priceList.code} ${priceList.name} esta inactiva`);
  }
  return priceList.id;
}
