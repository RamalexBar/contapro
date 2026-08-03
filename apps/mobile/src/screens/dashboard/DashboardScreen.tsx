import { useEffect, useState } from "react";
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import type { DashboardMetrics } from "@erp/shared-types";
import { formatCOP } from "@erp/shared-utils";
import { apiFetch } from "../../lib/api-client";
import { useAuthStore } from "../../store/useAuthStore";

export function DashboardScreen({ navigation }: { navigation: { replace: (name: string) => void } }) {
  const [metrics, setMetrics] = useState<DashboardMetrics | null>(null);
  const clearSession = useAuthStore((s) => s.clearSession);

  useEffect(() => {
    apiFetch<DashboardMetrics>("/dashboard/metrics").then(setMetrics).catch(() => setMetrics(null));
  }, []);

  function handleLogout() {
    clearSession();
    navigation.replace("Login");
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.header}>
        <Text style={styles.title}>Dashboard</Text>
        <TouchableOpacity onPress={handleLogout}>
          <Text style={styles.logout}>Salir</Text>
        </TouchableOpacity>
      </View>
      {!metrics && <Text>Cargando...</Text>}
      {metrics && (
        <>
          <MetricCard label="Ventas de hoy" value={formatCOP(metrics.salesToday.total)} />
          <MetricCard label="Ventas del mes" value={formatCOP(metrics.salesMonth.total)} />
          <MetricCard label="Productos agotados" value={String(metrics.outOfStockCount)} />
          <MetricCard label="Facturas pendientes" value={String(metrics.pendingInvoices)} />
        </>
      )}
    </ScrollView>
  );
}

function MetricCard({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.card}>
      <Text style={styles.cardLabel}>{label}</Text>
      <Text style={styles.cardValue}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#f9fafb" },
  content: { padding: 16 },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 16 },
  title: { fontSize: 20, fontWeight: "600" },
  logout: { color: "#dc2626", fontWeight: "600" },
  card: { backgroundColor: "#fff", borderRadius: 8, padding: 16, marginBottom: 12, borderWidth: 1, borderColor: "#e5e7eb" },
  cardLabel: { color: "#6b7280", fontSize: 13 },
  cardValue: { fontSize: 20, fontWeight: "600", marginTop: 4 },
});
