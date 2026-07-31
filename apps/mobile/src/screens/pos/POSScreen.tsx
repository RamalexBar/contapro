import { useCallback, useEffect, useState } from "react";
import { FlatList, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { formatCOP } from "@erp/shared-utils";
import { apiFetch } from "../../lib/api-client";
import { useAuthStore } from "../../store/useAuthStore";
import { enqueueOfflineSale, getOrCreateDeviceId, listCachedProducts } from "../../lib/local-db/sqlite";
import { generateClientEventId } from "../../lib/sync/id";
import { getPendingSyncCount, pullProducts, runSync } from "../../lib/sync/sync-engine";

interface ProductListItem {
  id: string;
  name: string;
  currentPrice: number;
}

interface CartLine extends ProductListItem {
  quantity: number;
}

/**
 * POS offline-first: la lista de productos SIEMPRE se lee de products_cache (SQLite local), no
 * directo de la API -- funciona igual con o sin conexion. pullProducts() intenta refrescar la
 * cache al entrar a la pantalla (mejor esfuerzo, no bloquea si falla). El cobro intenta la API en
 * vivo primero; si falla (sin conexion), encola la venta en sales_outbox para que
 * runSync()/startBackgroundSync() la suba despues (ver lib/sync/sync-engine.ts).
 */
export function POSScreen() {
  const user = useAuthStore((s) => s.user);
  const [products, setProducts] = useState<ProductListItem[]>([]);
  const [cart, setCart] = useState<CartLine[]>([]);
  const [message, setMessage] = useState<string | null>(null);
  const [pendingCount, setPendingCount] = useState(0);
  const [syncing, setSyncing] = useState(false);

  const loadCachedProducts = useCallback(async () => {
    const rows = await listCachedProducts();
    setProducts(rows.map((r) => ({ id: r.id, name: r.name, currentPrice: r.current_price })));
  }, []);

  const refreshPendingCount = useCallback(async () => {
    setPendingCount(await getPendingSyncCount());
  }, []);

  useEffect(() => {
    pullProducts()
      .catch(() => {
        // sin conexion: se sigue con lo que ya haya en la cache local
      })
      .finally(loadCachedProducts);
    refreshPendingCount();
  }, [loadCachedProducts, refreshPendingCount]);

  async function handleManualSync() {
    setSyncing(true);
    try {
      await runSync();
      await loadCachedProducts();
      await refreshPendingCount();
      setMessage("Sincronizacion completada.");
    } catch {
      setMessage("No se pudo sincronizar (sin conexion).");
    } finally {
      setSyncing(false);
    }
  }

  function addToCart(product: ProductListItem) {
    setCart((prev) => {
      const existing = prev.find((l) => l.id === product.id);
      if (existing) return prev.map((l) => (l.id === product.id ? { ...l, quantity: l.quantity + 1 } : l));
      return [...prev, { ...product, quantity: 1 }];
    });
  }

  const total = cart.reduce((sum, l) => sum + l.currentPrice * l.quantity, 0);

  async function checkout() {
    const payload = {
      branchId: user?.branchId,
      items: cart.map((l) => ({ productId: l.id, quantity: l.quantity, discountPercent: 0 })),
      payments: [{ method: "CASH", amount: Math.round(total) }],
    };
    try {
      await apiFetch("/sales", { method: "POST", body: payload });
      setMessage("Venta registrada.");
      setCart([]);
    } catch {
      const deviceId = await getOrCreateDeviceId();
      await enqueueOfflineSale(generateClientEventId(deviceId), payload);
      setMessage("Sin conexion: venta encolada para sincronizar despues.");
      setCart([]);
      await refreshPendingCount();
    }
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Punto de venta</Text>
        <TouchableOpacity style={styles.syncButton} onPress={handleManualSync} disabled={syncing}>
          <Text style={styles.syncButtonText}>
            {syncing ? "Sincronizando..." : pendingCount > 0 ? `Sincronizar (${pendingCount})` : "Sincronizar"}
          </Text>
        </TouchableOpacity>
      </View>
      <FlatList
        data={products}
        keyExtractor={(p) => p.id}
        renderItem={({ item }) => (
          <TouchableOpacity style={styles.productRow} onPress={() => addToCart(item)}>
            <Text>{item.name}</Text>
            <Text style={styles.price}>{formatCOP(item.currentPrice)}</Text>
          </TouchableOpacity>
        )}
        style={styles.list}
        ListEmptyComponent={<Text style={styles.empty}>Sin productos en cache. Conectate para sincronizar.</Text>}
      />
      <View style={styles.cartBar}>
        <Text style={styles.total}>Total: {formatCOP(total)}</Text>
        <TouchableOpacity style={styles.checkoutButton} onPress={checkout} disabled={cart.length === 0}>
          <Text style={styles.checkoutText}>Cobrar</Text>
        </TouchableOpacity>
      </View>
      {message && <Text style={styles.message}>{message}</Text>}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#f9fafb", padding: 16 },
  header: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 12 },
  title: { fontSize: 20, fontWeight: "600" },
  syncButton: { backgroundColor: "#e5e7eb", paddingHorizontal: 12, paddingVertical: 6, borderRadius: 6 },
  syncButtonText: { fontSize: 12, fontWeight: "600", color: "#374151" },
  list: { flex: 1 },
  empty: { textAlign: "center", color: "#9ca3af", marginTop: 24 },
  productRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    backgroundColor: "#fff",
    padding: 12,
    borderRadius: 8,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: "#e5e7eb",
  },
  price: { color: "#6b7280" },
  cartBar: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingTop: 12 },
  total: { fontWeight: "600", fontSize: 16 },
  checkoutButton: { backgroundColor: "#2563eb", paddingHorizontal: 20, paddingVertical: 10, borderRadius: 8 },
  checkoutText: { color: "#fff", fontWeight: "600" },
  message: { marginTop: 8, color: "#059669" },
});
