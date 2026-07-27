import { useEffect, useState } from "react";
import { FlatList, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { formatCOP } from "@erp/shared-utils";
import { apiFetch } from "../../lib/api-client";
import { useAuthStore } from "../../store/useAuthStore";
import { enqueueOfflineSale } from "../../lib/local-db/sqlite";

interface ProductListItem {
  id: string;
  name: string;
  currentPrice: number;
}

interface CartLine extends ProductListItem {
  quantity: number;
}

/**
 * Scaffold de POS movil: consume los mismos endpoints REST que apps/web
 * (GET /products, POST /sales). NO implementa todavia el flujo offline completo
 * (si el fetch falla por falta de red, encola la venta en sales_outbox para sincronizar
 * despues, pero el motor de sync real esta pendiente, ver modules/sync/README.md).
 */
export function POSScreen() {
  const user = useAuthStore((s) => s.user);
  const [products, setProducts] = useState<ProductListItem[]>([]);
  const [cart, setCart] = useState<CartLine[]>([]);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    apiFetch<{ data: ProductListItem[] }>("/products")
      .then((res) => setProducts(res.data))
      .catch(() => setProducts([]));
  }, []);

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
      await enqueueOfflineSale(`${Date.now()}`, payload);
      setMessage("Sin conexion: venta encolada para sincronizar despues.");
      setCart([]);
    }
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Punto de venta</Text>
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
  title: { fontSize: 20, fontWeight: "600", marginBottom: 12 },
  list: { flex: 1 },
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
