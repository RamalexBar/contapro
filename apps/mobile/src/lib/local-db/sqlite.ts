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
