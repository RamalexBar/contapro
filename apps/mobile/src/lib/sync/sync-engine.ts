import { Platform } from "react-native";
import { apiFetch } from "../api-client";
import { useAuthStore } from "../../store/useAuthStore";
import {
  countPendingOutboxSales,
  getLastPullSyncedAt,
  getOrCreateDeviceId,
  listPendingOutboxSales,
  markOutboxSaleFailed,
  markOutboxSaleSynced,
  setLastPullSyncedAt,
  upsertCachedProducts,
} from "../local-db/sqlite";

interface PulledProduct {
  id: string;
  sku: string;
  name: string;
  currentPrice: number;
  currentCost: number;
  barcode: string | null;
  updatedAt: string;
}

interface PullResponse {
  products: PulledProduct[];
  syncedAt: string;
}

interface PushResult {
  clientEventId: string;
  status: "SYNCED" | "ERROR" | "CONFLICT";
  entityId?: string;
  error?: string;
}

function platformCode(): "ANDROID" | "IOS" | "WEB" {
  if (Platform.OS === "android") return "ANDROID";
  if (Platform.OS === "ios") return "IOS";
  return "WEB";
}

/**
 * Trae el catalogo cambiado desde el ultimo pull (o todo, la primera vez) y actualiza
 * products_cache -- POSScreen lee SIEMPRE de la cache local (nunca directo de la API), asi que
 * esto es lo que la mantiene fresca cuando hay conexion.
 */
export async function pullProducts(): Promise<void> {
  const since = await getLastPullSyncedAt();
  const query = since ? `?since=${encodeURIComponent(since)}` : "";
  const res = await apiFetch<PullResponse>(`/sync/pull${query}`);
  await upsertCachedProducts(res.products);
  await setLastPullSyncedAt(res.syncedAt);
}

/**
 * Sube las ventas encoladas en sales_outbox. Idempotente del lado del servidor (mismo
 * clientEventId = mismo resultado, ver PushSyncEventsUseCase), asi que reintentar un push que
 * quedo a medias (ej. la respuesta se perdio por la red) es seguro.
 */
export async function pushOutbox(): Promise<void> {
  const pending = await listPendingOutboxSales();
  if (pending.length === 0) return;

  const deviceId = await getOrCreateDeviceId();
  const res = await apiFetch<{ data: PushResult[] }>("/sync/push", {
    method: "POST",
    body: {
      deviceId,
      platform: platformCode(),
      events: pending.map((row) => ({
        clientEventId: row.id,
        entityType: "SALE",
        payload: JSON.parse(row.payload),
      })),
    },
  });

  for (const result of res.data) {
    if (result.status === "SYNCED") {
      await markOutboxSaleSynced(result.clientEventId);
    } else {
      await markOutboxSaleFailed(result.clientEventId, result.status, result.error ?? "Error desconocido");
    }
  }
}

/** Mejor esfuerzo: cada mitad (pull/push) se intenta aunque la otra falle, y ningun fallo se
 * propaga -- se reintenta en el siguiente tick de startBackgroundSync. */
export async function runSync(): Promise<void> {
  await pullProducts().catch((err) => console.warn("[sync] pull fallo:", err));
  await pushOutbox().catch((err) => console.warn("[sync] push fallo:", err));
}

export async function getPendingSyncCount(): Promise<number> {
  return countPendingOutboxSales();
}

/**
 * Sin NetInfo (no se agrego como dependencia nueva -- no hay forma de probar en este entorno que
 * el modulo nativo enlace correctamente sin un dispositivo/emulador real, ver README). En su
 * lugar: intervalo simple mientras la app esta abierta. Alcanza el mismo resultado practico
 * ("sincroniza al reconectar") con un retraso de como mucho `intervalMs`, sin el riesgo de una
 * dependencia nativa sin verificar.
 */
export function startBackgroundSync(intervalMs = 30_000): () => void {
  const timer = setInterval(() => {
    if (useAuthStore.getState().accessToken) {
      runSync().catch(() => {});
    }
  }, intervalMs);
  return () => clearInterval(timer);
}
