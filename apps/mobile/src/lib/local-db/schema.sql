-- Esquema minimo de SQLite local (scaffold). Sirve como cache offline de solo-lectura para
-- productos y como cola de salida (outbox) para ventas registradas sin conexion. El motor de
-- sincronizacion real (subir el outbox, bajar cambios) es responsabilidad de
-- apps/api/src/modules/sync (STUB) y NO esta implementado todavia en esta iteracion.

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
  id TEXT PRIMARY KEY,
  payload TEXT NOT NULL,       -- JSON con el mismo shape de CreateSaleInput
  status TEXT NOT NULL DEFAULT 'PENDING', -- PENDING | SYNCED | ERROR
  created_at TEXT NOT NULL,
  synced_at TEXT
);
