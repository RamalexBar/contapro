# Modulo: Sincronizacion Offline (STUB)

Estado: **modelo de datos completo en Prisma (patron outbox), sin motor de sincronizacion
implementado. El scaffold de SQLite en el movil existe (`apps/mobile/src/lib/local-db`), pero
no esta conectado a este modulo todavia.**

## Modelos ya disponibles (`packages/database/prisma/schema/sync.prisma`)

- `SyncDevice` — dispositivo registrado (movil/web) por usuario, con `lastSyncAt`.
- `SyncOutbox` — cola de cambios pendientes de sincronizar (`entityType`, `operation`,
  `payload`, `status`: PENDING/SYNCED/CONFLICT/ERROR).
- `SyncConflictLog` — registro de conflictos y su resolucion (SERVER_WINS/CLIENT_WINS/MANUAL).

## Diseño previsto (outbox pattern)

1. La app movil trabaja contra SQLite local cuando no hay conexion (ventas, movimientos de
   caja, ajustes de inventario) y encola cada cambio en una tabla local espejo de `SyncOutbox`.
2. Al recuperar conexion, la app sincroniza contra `POST /sync/push` (envia su cola local) y
   `GET /sync/pull` (trae los cambios del servidor desde `lastSyncAt`).
3. El servidor aplica cada operacion de la forma en que lo haria el endpoint REST equivalente
   (reutilizando los mismos casos de uso de `modules/pos`, `modules/inventory`, `modules/cash`),
   detecta conflictos (ej. venta ya registrada por otro dispositivo) y los deja en
   `SyncConflictLog` para resolucion manual si no se puede resolver automaticamente.
4. `SyncDevice.lastSyncAt` se actualiza al final de cada sincronizacion exitosa.

## Que falta implementar

1. Endpoints `POST /sync/push` y `GET /sync/pull`.
2. Logica de resolucion de conflictos (por defecto: server-wins, con excepciones documentadas
   por tipo de entidad).
3. Cliente movil: cola local en SQLite + disparador de sync al detectar conexion
   (`NetInfo` de React Native).

Por ahora las rutas devuelven `501 Not Implemented` (ver `interfaces/sync.routes.ts`).
