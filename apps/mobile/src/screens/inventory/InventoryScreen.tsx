import { useCallback, useEffect, useMemo, useState } from "react";
import { FlatList, StyleSheet, Text, TextInput, View } from "react-native";
import { useAuthStore } from "../../store/useAuthStore";
import { getBranchStock } from "../../lib/api/stock.api";
import { listCachedProducts, listCachedStock, upsertCachedStock, type CachedProduct, type CachedStock } from "../../lib/local-db/sqlite";
import { pullProducts } from "../../lib/sync/sync-engine";

interface InventoryRow {
  id: string;
  sku: string;
  name: string;
  quantity: number | null;
}

/**
 * Item 42 de docs/ALCANCE.md. Pantalla de solo lectura -- CAJERO no tiene permisos de
 * ajuste/entrada/traslado de stock, asi que no hay nada que encolar offline aqui (a diferencia de
 * Caja). Reusa products_cache (ya existente, alimentada por pullProducts()) y agrega una cache
 * nueva, mas simple, stock_cache: se pide en vivo al entrar a la pantalla / pull-to-refresh
 * (mismo patron que DashboardScreen), no pasa por el motor de sync generico porque el stock
 * cambia con cada venta -- meterlo en el pull delta-since existente le quitaria el sentido.
 */
export function InventoryScreen() {
  const branchId = useAuthStore((s) => s.user?.branchId);
  const [products, setProducts] = useState<CachedProduct[]>([]);
  const [stock, setStock] = useState<CachedStock[]>([]);
  const [search, setSearch] = useState("");
  const [refreshing, setRefreshing] = useState(false);
  const [offline, setOffline] = useState(false);

  const loadFromCache = useCallback(async () => {
    const [cachedProducts, cachedStock] = await Promise.all([
      listCachedProducts(),
      branchId ? listCachedStock(branchId) : Promise.resolve([]),
    ]);
    setProducts(cachedProducts);
    setStock(cachedStock);
  }, [branchId]);

  const refresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await pullProducts();
      if (branchId) {
        const res = await getBranchStock(branchId);
        await upsertCachedStock(branchId, res.data);
      }
      setOffline(false);
    } catch {
      setOffline(true);
    } finally {
      await loadFromCache();
      setRefreshing(false);
    }
  }, [branchId, loadFromCache]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const rows: InventoryRow[] = useMemo(() => {
    const stockByProductId = new Map(stock.map((s) => [s.product_id, s.quantity]));
    const term = search.trim().toLowerCase();
    return products
      .filter((p) => !term || p.name.toLowerCase().includes(term) || p.sku.toLowerCase().includes(term))
      .map((p) => ({ id: p.id, sku: p.sku, name: p.name, quantity: stockByProductId.get(p.id) ?? null }));
  }, [products, stock, search]);

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Inventario</Text>
      {offline && <Text style={styles.offlineTag}>Sin conexion -- mostrando el ultimo stock conocido</Text>}
      <TextInput
        style={styles.search}
        placeholder="Buscar por nombre o SKU"
        value={search}
        onChangeText={setSearch}
      />
      <FlatList
        data={rows}
        keyExtractor={(r) => r.id}
        onRefresh={refresh}
        refreshing={refreshing}
        renderItem={({ item }) => (
          <View style={styles.row}>
            <View>
              <Text style={styles.name}>{item.name}</Text>
              <Text style={styles.sku}>{item.sku}</Text>
            </View>
            <Text style={styles.quantity}>{item.quantity === null ? "Sin datos" : `${item.quantity} und.`}</Text>
          </View>
        )}
        ListEmptyComponent={<Text style={styles.empty}>Sin productos en cache. Conectate para sincronizar.</Text>}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#f9fafb", padding: 16 },
  title: { fontSize: 20, fontWeight: "600", marginBottom: 8 },
  offlineTag: { color: "#b45309", fontSize: 12, marginBottom: 8, fontWeight: "600" },
  search: { borderWidth: 1, borderColor: "#e5e7eb", borderRadius: 6, padding: 10, marginBottom: 12, backgroundColor: "#fff" },
  row: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    backgroundColor: "#fff",
    padding: 12,
    borderRadius: 8,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: "#e5e7eb",
  },
  name: { fontWeight: "500" },
  sku: { color: "#9ca3af", fontSize: 12, marginTop: 2 },
  quantity: { color: "#374151", fontWeight: "600" },
  empty: { textAlign: "center", color: "#9ca3af", marginTop: 24 },
});
