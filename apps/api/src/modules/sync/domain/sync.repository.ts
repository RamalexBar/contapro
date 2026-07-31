export type SyncOutboxStatus = "PENDING" | "SYNCED" | "CONFLICT" | "ERROR";

export interface SyncOutboxRecord {
  id: string;
  clientEventId: string;
  entityType: string;
  entityId: string | null;
  operation: string;
  payload: unknown;
  status: SyncOutboxStatus;
  errorMessage: string | null;
  syncedAt: Date | null;
}

export interface CreateOutboxPendingData {
  clientEventId: string;
  branchId: string;
  entityType: string;
  operation: string;
  payload: unknown;
  originDeviceId: string;
}

export interface UpsertDeviceData {
  deviceIdentifier: string;
  platform: string;
  branchId: string;
  userId: string;
}

export interface PulledProduct {
  id: string;
  sku: string;
  name: string;
  currentPrice: number;
  currentCost: number;
  barcode: string | null;
  updatedAt: Date;
}

export interface ISyncRepository {
  /** Registra el dispositivo si es la primera vez que sincroniza, o actualiza sus datos. No
   * toca lastSyncAt -- eso lo hace touchDeviceLastSync al terminar un push/pull exitoso. */
  upsertDevice(data: UpsertDeviceData): Promise<void>;
  touchDeviceLastSync(deviceIdentifier: string): Promise<void>;
  findOutboxByClientEventId(clientEventId: string): Promise<SyncOutboxRecord | null>;
  createOutboxPending(data: CreateOutboxPendingData): Promise<SyncOutboxRecord>;
  markOutboxSynced(id: string, entityId: string): Promise<void>;
  markOutboxError(id: string, message: string): Promise<void>;
  createConflictLog(outboxEventId: string, reason: string): Promise<void>;
  /** Todos los productos activos de la empresa modificados despues de `since` (null = todos,
   * primera sincronizacion del dispositivo). Limitado a 500 -- suficiente para el catalogo de
   * una PYME, no se pagino por ahora (ver README). */
  listProductsChangedSince(since: Date | null): Promise<PulledProduct[]>;
}
