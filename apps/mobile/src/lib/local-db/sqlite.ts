import * as SQLite from "expo-sqlite";

const DB_NAME = "erp_offline.db";

let dbPromise: ReturnType<typeof SQLite.openDatabaseAsync> | null = null;

function getDb() {
  if (!dbPromise) dbPromise = SQLite.openDatabaseAsync(DB_NAME);
  return dbPromise;
}

/**
 * Crea las tablas locales (ver schema.sql) si no existen. Llamar una vez al arrancar la app
 * (por ejemplo en App.tsx) antes de usar cualquier repositorio offline.
 *
 * NOTA (scaffold): solo crea el esquema. La logica de "cachear productos al sincronizar" y
 * "drenar sales_outbox al recuperar conexion" pertenece al modulo de sync (ver
 * apps/api/src/modules/sync/README.md) y aun no esta implementada.
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
      created_at TEXT NOT NULL,
      synced_at TEXT
    );
  `);
}

export async function enqueueOfflineSale(id: string, payload: unknown): Promise<void> {
  const db = await getDb();
  await db.runAsync(
    "INSERT INTO sales_outbox (id, payload, status, created_at) VALUES (?, ?, 'PENDING', ?)",
    id,
    JSON.stringify(payload),
    new Date().toISOString()
  );
}
