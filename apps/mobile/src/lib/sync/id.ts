/**
 * Id local sin dependencias nuevas (sin `uuid`/`expo-crypto`, ver README del modulo de sync
 * sobre por que no se agregaron paquetes nativos no verificables en este entorno). El servidor
 * deduplica por `clientEventId` a nivel de EMPRESA, no por dispositivo (ver
 * apps/api/src/modules/sync/domain/sync.repository.ts), asi que el id debe ser unico entre
 * TODOS los dispositivos de la empresa -- por eso se prefija con el device id (ver
 * lib/sync/device.ts) ademas del timestamp + sufijo aleatorio.
 */
export function generateClientEventId(deviceId: string): string {
  return `${deviceId}-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}
