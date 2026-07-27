import { useEffect, useState } from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import type { DashboardMetrics } from "@erp/shared-types";
import { formatCOP } from "@erp/shared-utils";
import { apiFetch } from "../../lib/api-client";

export function DashboardScreen() {
  const [metrics, setMetrics] = useState<DashboardMetrics | null>(null);

  useEffect(() => {
    apiFetch<DashboardMetrics>("/dashboard/metrics").then(setMetrics).catch(() => setMetrics(null));
  }, []);

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.title}>Dashboard</Text>
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
  title: { fontSize: 20, fontWeight: "600", marginBottom: 16 },
  card: { backgroundColor: "#fff", borderRadius: 8, padding: 16, marginBottom: 12, borderWidth: 1, borderColor: "#e5e7eb" },
  cardLabel: { color: "#6b7280", fontSize: 13 },
  cardValue: { fontSize: 20, fontWeight: "600", marginTop: 4 },
});
