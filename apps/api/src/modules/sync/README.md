# Modulo: Sincronizacion Offline

Estado: **motor real implementado para ventas (patron outbox), iteracion 18.** El resto de
entidades mencionadas en el modelo original (`CashMovement`, `StockMovement`) siguen sin
soporte -- ver "Que falta implementar".

## Modelos (`packages/database/prisma/schema/sync.prisma`)

- `SyncDevice` — dispositivo registrado (movil/web) por usuario, con `lastSyncAt`. Se
  crea/actualiza en cada `POST /sync/push`.
- `SyncOutbox` — cola de cambios sincronizados (`entityType`, `operation`, `payload`, `status`:
  PENDING/SYNCED/CONFLICT/ERROR). Ganó `clientEventId` (clave de idempotencia, generada por el
  cliente al encolar el evento localmente) y `errorMessage` en la iteración 18 — antes solo
  existían como columnas planeadas sin usar. `entityId` ahora es nullable (no hay entidad todavía
  mientras el evento está PENDING/ERROR).
- `SyncConflictLog` — registro de conflictos reales (mismo `clientEventId`, payload distinto).

## Diseño (outbox pattern) — cómo funciona de verdad

1. La app móvil trabaja contra SQLite local (`apps/mobile/src/lib/local-db`): `products_cache`
   (lectura, la lee siempre POSScreen, online o no) y `sales_outbox` (cola de ventas hechas sin
   conexión, cada fila usa como `id` el `clientEventId` que se va a enviar al servidor).
2. Al recuperar conexión (o cada 30s mientras la app está abierta, ver "Sin NetInfo" abajo), la
   app llama `POST /sync/push` (sube la cola local) y `GET /sync/pull` (trae cambios del
   servidor desde el último pull).
3. El servidor aplica cada evento reusando el MISMO caso de uso que el endpoint REST equivalente
   (`CreateSaleUseCase`, el de `POST /sales`, sin ningún caso de uso nuevo ni lógica de negocio
   duplicada) — ver `PushSyncEventsUseCase`.
4. `SyncDevice.lastSyncAt` se actualiza al final de cada `push` exitoso.

## Implementado

1. **`POST /sync/push`** (permiso `sale.create`, reusado — no se creó un permiso nuevo solo para
   sync, ver `sync.routes.ts`): recibe `{ deviceId, platform, events: [{ clientEventId,
   entityType: "SALE", payload }] }`.
   - Solo `entityType: "SALE"` soportado por ahora (ver "Que falta implementar").
   - **Idempotente por `clientEventId`** (único por empresa): reenviar el mismo evento (ej. la
     respuesta anterior se perdió por la red) devuelve el mismo resultado sin crear una segunda
     venta. La comparación de payload usa `stableStringify` (ordena claves recursivamente) en vez
     de `JSON.stringify` plano — **bug real encontrado y corregido durante este trabajo**:
     Postgres JSONB no preserva el orden de inserción de las claves, así que comparar el payload
     recién llegado contra el que se releyó de la base con `JSON.stringify` normal daba falsos
     positivos de conflicto para el mismo evento reenviado.
   - Si el mismo `clientEventId` llega con un payload DISTINTO al que ya existe: conflicto real,
     se registra en `SyncConflictLog` y el evento queda `CONFLICT` (no se reprocesa).
   - Si el evento ya está `SYNCED`: se devuelve el resultado guardado (retry idempotente).
   - Si ya está `ERROR`: NO se reintenta automáticamente (si la venta alcanzó a crearse antes de
     que fallara un paso posterior — ver limitación conocida de `CreateSaleUseCase`, la
     contabilización no está en la misma transacción — reintentar podría duplicarla). Queda para
     revisión manual.
   - Si está `PENDING` (el servidor se cayó a mitad de proceso, sin haber llegado a crear la
     venta): se reintenta, es seguro.
2. **`GET /sync/pull?since=<ISO>`**: productos activos de la empresa modificados después de
   `since` (o todos si no se manda, primera sincronización del dispositivo) — id, sku, nombre,
   precio, costo, código de barras. Limitado a 500 filas, sin paginar (suficiente para el
   catálogo de una PYME). `since` ausente = trae todo el catálogo.
3. Reusa `sale.create` (push) y `product.read` (pull) — no se crearon permisos nuevos, push/pull
   hacen exactamente lo mismo que `POST /sales`/`GET /products`, solo en lote desde el cliente
   móvil.

## Cliente móvil (`apps/mobile/src/lib`)

- `local-db/sqlite.ts`: además de `products_cache`/`sales_outbox` (ya existían como scaffold),
  ahora hay `sync_meta` (key/value) para el device id (generado una vez, persistido localmente) y
  la marca de tiempo del último pull exitoso.
- `sync/id.ts`: `generateClientEventId(deviceId)` — sin dependencias nuevas (`uuid`/
  `expo-crypto`, ver más abajo). El id se prefija con el device id porque el servidor deduplica
  por `clientEventId` a nivel de EMPRESA, no por dispositivo.
- `sync/sync-engine.ts`: `pullProducts()`, `pushOutbox()`, `runSync()` (ambas, mejor esfuerzo —
  un fallo en una mitad no bloquea la otra ni se propaga), `startBackgroundSync()`.
- `POSScreen` ahora lee **siempre** de `products_cache` (nunca directo de la API) — funciona
  igual online/offline. `pullProducts()` refresca la cache en cada entrada a la pantalla, mejor
  esfuerzo. El cobro intenta la API en vivo primero; si falla, encola en `sales_outbox`.
- Botón manual "Sincronizar" en `POSScreen` con contador de ventas pendientes.

### Sin NetInfo (decisión deliberada)

No se agregó `@react-native-community/netinfo` (detección real de reconexión) como dependencia
nueva: este entorno de desarrollo no tiene un dispositivo/emulador para verificar que un módulo
nativo enlace correctamente, y agregar una dependencia nativa sin poder probarla en runtime es
más riesgo del que vale la pena para esta iteración. En su lugar, `startBackgroundSync()` usa un
intervalo simple (30s) mientras la app está abierta — logra el mismo resultado práctico
("sincroniza al reconectar") con un retraso de como mucho 30 segundos, sin el riesgo de una
dependencia nativa no verificada. Migrar a NetInfo más adelante es un cambio acotado a ese
archivo.

## Verificado en este entorno

Todo el flujo de `push`/`pull` se probó en vivo contra el servidor de desarrollo (curl, no hay
emulador disponible en este entorno):

- Push de una venta nueva → `SYNCED`, `Sale` creada de verdad.
- Reenvío del mismo `clientEventId` con el mismo payload → `SYNCED` idempotente, sin duplicar la
  venta (incluyendo el caso con las claves del payload en otro orden, el bug de JSONB descrito
  arriba).
- Mismo `clientEventId` con payload distinto → `CONFLICT`, registrado en `SyncConflictLog`.
- Producto inexistente → `ERROR` con mensaje claro, sin tumbar el request; un reintento del mismo
  evento no vuelve a intentar la venta.
- Push con varios eventos en un solo request → cada uno se resuelve independientemente.
- `GET /sync/pull` sin `since` trae el catálogo completo; `SyncDevice.lastSyncAt` se actualiza.

## Que falta implementar

1. **`CashMovement`/`StockMovement` como entidades sincronizables** — el modelo (`SyncOutbox.
   entityType`) ya lo contempla, pero el scaffold móvil actual (`apps/mobile`) solo tiene pantalla
   de POS/ventas; no hay UI ni tabla local para movimientos de caja o ajustes de inventario
   offline todavía. `PushSyncEventsUseCase.SUPPORTED_ENTITY_TYPES` es donde se agregaría cada
   nuevo tipo, reusando su caso de uso REST equivalente igual que se hizo con `Sale`.
2. **NetInfo real** para detección de reconexión en vez del intervalo de 30s — ver aviso arriba.
3. **Persistencia de sesión en el móvil**: `useAuthStore` sigue siendo solo en memoria (ver su
   propio comentario) — cerrar la app pierde la sesión, lo cual interrumpe el ciclo de sync en la
   práctica aunque el motor en sí funcione. Necesita `AsyncStorage` + middleware `persist` de
   zustand, fuera del alcance de este trabajo (es un problema de auth, no de sync).
4. Resolución de conflictos más allá de "detectar y loguear" — hoy `SyncConflictLog` se llena
   pero no hay UI ni endpoint para resolverlos manualmente (`resolution`/`resolvedByUserId`
   siguen sin usarse).
