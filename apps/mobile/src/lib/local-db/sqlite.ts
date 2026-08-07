import * as SQLite from "expo-sqlite";

const DB_NAME = "erp_offline.db";

let dbPromise: ReturnType<typeof SQLite.openDatabaseAsync> | null = null;

function getDb() {
  if (!dbPromise) dbPromise = SQLite.openDatabaseAsync(DB_NAME);
  return dbPromise;
}

/**
 * Crea las tablas locales (ver schema.sql) si no existen. Llamar una vez al arrancar la app
 * (App.tsx) antes de usar cualquier repositorio offline.
 */
export async function initLocalDatabase(): Promise<void> {
  const db = await getDb();
  await db.execAsync(`
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
      payload TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'PENDING',
      error_message TEXT,
      created_at TEXT NOT NULL,
      synced_at TEXT
    );
    CREATE TABLE IF NOT EXISTS sync_meta (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS cash_movements_outbox (
      id TEXT PRIMARY KEY,
      payload TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'PENDING',
      error_message TEXT,
      created_at TEXT NOT NULL,
      synced_at TEXT
    );
    CREATE TABLE IF NOT EXISTS active_cash_session_cache (
      cash_register_id TEXT PRIMARY KEY,
      session_json TEXT,
      cached_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS stock_cache (
      product_id TEXT NOT NULL,
      branch_id TEXT NOT NULL,
      quantity REAL NOT NULL,
      min_stock REAL NOT NULL,
      max_stock REAL NOT NULL,
      cached_at TEXT NOT NULL,
      PRIMARY KEY (product_id, branch_id)
    );
  `);
}

// ---- sales_outbox ----

export interface OutboxSaleRow {
  id: string;
  payload: string;
  status: "PENDING" | "SYNCED" | "ERROR" | "CONFLICT";
  error_message: string | null;
  created_at: string;
  synced_at: string | null;
}

/** `id` es el clientEventId que se envia al servidor -- ver lib/sync/id.ts. */
export async function enqueueOfflineSale(id: string, payload: unknown): Promise<void> {
  const db = await getDb();
  await db.runAsync(
    "INSERT INTO sales_outbox (id, payload, status, created_at) VALUES (?, ?, 'PENDING', ?)",
    id,
    JSON.stringify(payload),
    new Date().toISOString()
  );
}

export async function listPendingOutboxSales(): Promise<OutboxSaleRow[]> {
  const db = await getDb();
  return db.getAllAsync<OutboxSaleRow>("SELECT * FROM sales_outbox WHERE status = 'PENDING' ORDER BY created_at ASC");
}

export async function countPendingOutboxSales(): Promise<number> {
  const db = await getDb();
  const row = await db.getFirstAsync<{ count: number }>("SELECT COUNT(*) as count FROM sales_outbox WHERE status = 'PENDING'");
  return row?.count ?? 0;
}

export async function markOutboxSaleSynced(id: string): Promise<void> {
  const db = await getDb();
  await db.runAsync("UPDATE sales_outbox SET status = 'SYNCED', synced_at = ? WHERE id = ?", new Date().toISOString(), id);
}

export async function markOutboxSaleFailed(id: string, status: "ERROR" | "CONFLICT", message: string): Promise<void> {
  const db = await getDb();
  await db.runAsync("UPDATE sales_outbox SET status = ?, error_message = ? WHERE id = ?", status, message, id);
}

// ---- products_cache ----

export interface CachedProduct {
  id: string;
  sku: string;
  name: string;
  current_price: number;
  current_cost: number;
  barcode: string | null;
}

export interface PulledProductInput {
  id: string;
  sku: string;
  name: string;
  currentPrice: number;
  currentCost: number;
  barcode: string | null;
}

export async function upsertCachedProducts(products: PulledProductInput[]): Promise<void> {
  if (products.length === 0) return;
  const db = await getDb();
  const now = new Date().toISOString();
  await db.withTransactionAsync(async () => {
    for (const p of products) {
      await db.runAsync(
        `INSERT INTO products_cache (id, sku, name, current_price, current_cost, barcode, synced_at)
         VALUES (?, ?, ?, ?, ?, ?, ?)
         ON CONFLICT(id) DO UPDATE SET
           sku = excluded.sku, name = excluded.name, current_price = excluded.current_price,
           current_cost = excluded.current_cost, barcode = excluded.barcode, synced_at = excluded.synced_at`,
        p.id,
        p.sku,
        p.name,
        p.currentPrice,
        p.currentCost,
        p.barcode,
        now
      );
    }
  });
}

export async function listCachedProducts(): Promise<CachedProduct[]> {
  const db = await getDb();
  return db.getAllAsync<CachedProduct>("SELECT * FROM products_cache ORDER BY name ASC");
}

// ---- cash_movements_outbox (item 42 de docs/ALCANCE.md) ----

export interface OutboxCashMovementRow {
  id: string;
  payload: string;
  status: "PENDING" | "SYNCED" | "ERROR" | "CONFLICT";
  error_message: string | null;
  created_at: string;
  synced_at: string | null;
}

/** `id` es el clientEventId que se envia al servidor -- ver lib/sync/id.ts. `payload` incluye
 * cashSessionId (ver cashMovementSyncPayloadSchema en @erp/shared-types). */
export async function enqueueOfflineCashMovement(id: string, payload: unknown): Promise<void> {
  const db = await getDb();
  await db.runAsync(
    "INSERT INTO cash_movements_outbox (id, payload, status, created_at) VALUES (?, ?, 'PENDING', ?)",
    id,
    JSON.stringify(payload),
    new Date().toISOString()
  );
}

export async function listPendingOutboxCashMovements(): Promise<OutboxCashMovementRow[]> {
  const db = await getDb();
  return db.getAllAsync<OutboxCashMovementRow>("SELECT * FROM cash_movements_outbox WHERE status = 'PENDING' ORDER BY created_at ASC");
}

export async function countPendingOutboxCashMovements(): Promise<number> {
  const db = await getDb();
  const row = await db.getFirstAsync<{ count: number }>("SELECT COUNT(*) as count FROM cash_movements_outbox WHERE status = 'PENDING'");
  return row?.count ?? 0;
}

export async function markOutboxCashMovementSynced(id: string): Promise<void> {
  const db = await getDb();
  await db.runAsync("UPDATE cash_movements_outbox SET status = 'SYNCED', synced_at = ? WHERE id = ?", new Date().toISOString(), id);
}

export async function markOutboxCashMovementFailed(id: string, status: "ERROR" | "CONFLICT", message: string): Promise<void> {
  const db = await getDb();
  await db.runAsync("UPDATE cash_movements_outbox SET status = ?, error_message = ? WHERE id = ?", status, message, id);
}

// ---- active_cash_session_cache (item 42) ----

/** Una fila por cashRegisterId -- guarda la ultima sesion activa conocida (o null si se sabe que
 * no hay ninguna) para que CashScreen muestre algo aunque este offline. Se limpia al cerrar una
 * sesion con exito (clearCachedActiveCashSession). */
export async function cacheActiveCashSession(cashRegisterId: string, session: unknown): Promise<void> {
  const db = await getDb();
  await db.runAsync(
    `INSERT INTO active_cash_session_cache (cash_register_id, session_json, cached_at) VALUES (?, ?, ?)
     ON CONFLICT(cash_register_id) DO UPDATE SET session_json = excluded.session_json, cached_at = excluded.cached_at`,
    cashRegisterId,
    session === null ? null : JSON.stringify(session),
    new Date().toISOString()
  );
}

export async function getCachedActiveCashSession<T>(cashRegisterId: string): Promise<T | null> {
  const db = await getDb();
  const row = await db.getFirstAsync<{ session_json: string | null }>(
    "SELECT session_json FROM active_cash_session_cache WHERE cash_register_id = ?",
    cashRegisterId
  );
  if (!row?.session_json) return null;
  return JSON.parse(row.session_json) as T;
}

export async function clearCachedActiveCashSession(cashRegisterId: string): Promise<void> {
  const db = await getDb();
  await db.runAsync("DELETE FROM active_cash_session_cache WHERE cash_register_id = ?", cashRegisterId);
}

// ---- stock_cache (item 42) ----

export interface CachedStock {
  product_id: string;
  branch_id: string;
  quantity: number;
  min_stock: number;
  max_stock: number;
}

export async function upsertCachedStock(branchId: string, items: Array<{ productId: string; quantity: number; minStock: number; maxStock: number }>): Promise<void> {
  const db = await getDb();
  const now = new Date().toISOString();
  await db.withTransactionAsync(async () => {
    for (const item of items) {
      await db.runAsync(
        `INSERT INTO stock_cache (product_id, branch_id, quantity, min_stock, max_stock, cached_at)
         VALUES (?, ?, ?, ?, ?, ?)
         ON CONFLICT(product_id, branch_id) DO UPDATE SET
           quantity = excluded.quantity, min_stock = excluded.min_stock, max_stock = excluded.max_stock, cached_at = excluded.cached_at`,
        item.productId,
        branchId,
        item.quantity,
        item.minStock,
        item.maxStock,
        now
      );
    }
  });
}

export async function listCachedStock(branchId: string): Promise<CachedStock[]> {
  const db = await getDb();
  return db.getAllAsync<CachedStock>("SELECT * FROM stock_cache WHERE branch_id = ?", branchId);
}

// ---- sync_meta ----

async function getMeta(key: string): Promise<string | null> {
  const db = await getDb();
  const row = await db.getFirstAsync<{ value: string }>("SELECT value FROM sync_meta WHERE key = ?", key);
  return row?.value ?? null;
}

async function setMeta(key: string, value: string): Promise<void> {
  const db = await getDb();
  await db.runAsync(
    "INSERT INTO sync_meta (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value",
    key,
    value
  );
}

const DEVICE_ID_KEY = "device_id";
const LAST_PULL_KEY = "last_pull_synced_at";

export async function getOrCreateDeviceId(): Promise<string> {
  const existing = await getMeta(DEVICE_ID_KEY);
  if (existing) return existing;
  const generated = `mobile-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
  await setMeta(DEVICE_ID_KEY, generated);
  return generated;
}

export async function getLastPullSyncedAt(): Promise<string | null> {
  return getMeta(LAST_PULL_KEY);
}

export async function setLastPullSyncedAt(iso: string): Promise<void> {
  await setMeta(LAST_PULL_KEY, iso);
}
