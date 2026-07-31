import type { ISyncRepository, PulledProduct } from "../../domain/sync.repository";

export interface PullSyncChangesResult {
  products: PulledProduct[];
  syncedAt: string;
}

/**
 * Cambios del servidor desde `since` (null = primera sincronizacion del dispositivo, trae todo
 * el catalogo). Por ahora solo productos (precio/costo/codigo de barras) -- es lo unico que la
 * app movil cachea localmente (`products_cache`, ver apps/mobile/src/lib/local-db/schema.sql).
 */
export class PullSyncChangesUseCase {
  constructor(private readonly syncRepo: ISyncRepository) {}

  async execute(since: Date | null): Promise<PullSyncChangesResult> {
    const products = await this.syncRepo.listProductsChangedSince(since);
    return { products, syncedAt: new Date().toISOString() };
  }
}
