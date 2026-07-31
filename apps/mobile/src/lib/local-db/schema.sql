-- Esquema de SQLite local. products_cache es la cache offline de solo-lectura para productos
-- (lo que la app lee para armar el carrito, online o no) y sales_outbox es la cola de salida
-- para ventas registradas sin conexion. sync_meta guarda el id del dispositivo (generado una
-- vez, ver lib/sync/device.ts) y la marca de tiempo del ultimo pull exitoso. El motor de
-- sincronizacion real (subir el outbox, bajar cambios) vive en lib/sync/sync-engine.ts, contra
-- apps/api/src/modules/sync (POST /sync/push, GET /sync/pull).

CREATE TABLE IF NOT EXISTS products_cache (
  id TEXT PRIMARY KEY,
  sku TEXT NOT NULL,
  name TEXT NOT NULL,
  current_price REAL NOT NULL,
  current_cost REAL NOT NULL,
  barcode TEXT,
  synced_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS sales_outbox (
  id TEXT PRIMARY KEY,         -- clientEventId enviado al servidor, ver lib/sync/id.ts
  payload TEXT NOT NULL,       -- JSON con el mismo shape de CreateSaleInput
  status TEXT NOT NULL DEFAULT 'PENDING', -- PENDING | SYNCED | ERROR | CONFLICT
  error_message TEXT,
  created_at TEXT NOT NULL,
  synced_at TEXT
);

CREATE TABLE IF NOT EXISTS sync_meta (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);
