import { useCallback, useEffect, useState } from "react";
import { ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from "react-native";
import { formatCOP } from "@erp/shared-utils";
import { useAuthStore } from "../../store/useAuthStore";
import { closeSession, getActiveSession, listCashRegisters, openSession, registerCashMovement, type CashSessionResponse } from "../../lib/api/cash.api";
import {
  cacheActiveCashSession,
  clearCachedActiveCashSession,
  enqueueOfflineCashMovement,
  getCachedActiveCashSession,
  getOrCreateDeviceId,
} from "../../lib/local-db/sqlite";
import { generateClientEventId } from "../../lib/sync/id";
import { getPendingSyncCount, runSync } from "../../lib/sync/sync-engine";

const MOVEMENT_TYPES: Array<{ code: "INCOME" | "EXPENSE" | "WITHDRAWAL" | "DEPOSIT"; label: string }> = [
  { code: "INCOME", label: "Ingreso" },
  { code: "EXPENSE", label: "Egreso" },
  { code: "WITHDRAWAL", label: "Retiro" },
  { code: "DEPOSIT", label: "Consignacion" },
];

/**
 * Item 42 de docs/ALCANCE.md. Abrir/cerrar sesion son acciones online-only (punto sin retorno,
 * mismo criterio que otras acciones financieras "de una via" del backend) -- si fallan por falta
 * de conexion, se muestra el error, sin encolar. Registrar un movimiento SI se encola offline
 * (cash_movements_outbox) si el intento en vivo falla, mismo patron exacto que el cobro en
 * POSScreen. La sesion activa se cachea localmente (active_cash_session_cache) para que la
 * pantalla muestre algo aunque este offline.
 */
export function CashScreen() {
  const hasPermission = useAuthStore((s) => s.hasPermission);
  const [registerId, setRegisterId] = useState<string | null>(null);
  const [session, setSession] = useState<CashSessionResponse | null>(null);
  const [offline, setOffline] = useState(false);
  const [openingAmount, setOpeningAmount] = useState("");
  const [movementType, setMovementType] = useState<(typeof MOVEMENT_TYPES)[number]["code"]>("INCOME");
  const [amount, setAmount] = useState("");
  const [concept, setConcept] = useState("");
  const [closingAmount, setClosingAmount] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [pendingCount, setPendingCount] = useState(0);
  const [syncing, setSyncing] = useState(false);

  const refreshPendingCount = useCallback(async () => {
    setPendingCount(await getPendingSyncCount());
  }, []);

  const loadSession = useCallback(async (id: string) => {
    try {
      const active = await getActiveSession(id);
      setSession(active);
      setOffline(false);
      await cacheActiveCashSession(id, active);
    } catch {
      const cached = await getCachedActiveCashSession<CashSessionResponse | null>(id);
      setSession(cached);
      setOffline(true);
    }
  }, []);

  useEffect(() => {
    listCashRegisters()
      .then((res) => {
        const id = res.data[0]?.id ?? null;
        setRegisterId(id);
        if (id) loadSession(id);
      })
      .catch(() => setOffline(true));
    refreshPendingCount();
  }, [loadSession, refreshPendingCount]);

  async function handleOpen() {
    if (!registerId) return;
    try {
      const created = await openSession({ cashRegisterId: registerId, openingAmount: Number(openingAmount) || 0 });
      setSession(created);
      setOffline(false);
      await cacheActiveCashSession(registerId, created);
      setOpeningAmount("");
      setMessage("Sesion abierta.");
    } catch (err) {
      setMessage(`No se pudo abrir la sesion: ${(err as Error).message}`);
    }
  }

  async function handleClose() {
    if (!session || !registerId) return;
    try {
      await closeSession(session.id, { closingAmountCounted: Number(closingAmount) || 0 });
      await clearCachedActiveCashSession(registerId);
      setSession(null);
      setClosingAmount("");
      setMessage("Sesion cerrada.");
    } catch (err) {
      setMessage(`No se pudo cerrar la sesion: ${(err as Error).message}`);
    }
  }

  async function handleRegisterMovement() {
    if (!session) {
      setMessage("Abre una sesion primero (requiere conexion).");
      return;
    }
    const input = { type: movementType, amount: Number(amount) || 0, concept: concept.trim() || "Sin concepto" };
    try {
      await registerCashMovement(session.id, input);
      setMessage("Movimiento registrado.");
    } catch {
      const deviceId = await getOrCreateDeviceId();
      await enqueueOfflineCashMovement(generateClientEventId(deviceId), { cashSessionId: session.id, ...input });
      setMessage("Sin conexion: movimiento encolado para sincronizar despues.");
      await refreshPendingCount();
    }
    setAmount("");
    setConcept("");
  }

  async function handleManualSync() {
    setSyncing(true);
    try {
      await runSync();
      await refreshPendingCount();
      if (registerId) await loadSession(registerId);
      setMessage("Sincronizacion completada.");
    } catch {
      setMessage("No se pudo sincronizar (sin conexion).");
    } finally {
      setSyncing(false);
    }
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.header}>
        <Text style={styles.title}>Caja</Text>
        <TouchableOpacity style={styles.syncButton} onPress={handleManualSync} disabled={syncing}>
          <Text style={styles.syncButtonText}>
            {syncing ? "Sincronizando..." : pendingCount > 0 ? `Sincronizar (${pendingCount})` : "Sincronizar"}
          </Text>
        </TouchableOpacity>
      </View>

      <View style={styles.card}>
        {offline && <Text style={styles.offlineTag}>Sin conexion -- mostrando el ultimo estado conocido</Text>}
        {session ? (
          <>
            <Text style={styles.cardLabel}>Sesion activa</Text>
            <Text style={styles.cardValue}>{formatCOP(session.openingAmount)} apertura</Text>
            <Text style={styles.cardSub}>Abierta: {new Date(session.openedAt).toLocaleString()}</Text>
          </>
        ) : (
          <Text style={styles.cardLabel}>Sin sesion activa</Text>
        )}
      </View>

      {!session && hasPermission("cash.session.open") && (
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Abrir sesion</Text>
          <TextInput
            style={styles.input}
            placeholder="Monto de apertura"
            keyboardType="numeric"
            value={openingAmount}
            onChangeText={setOpeningAmount}
          />
          <TouchableOpacity style={styles.primaryButton} onPress={handleOpen}>
            <Text style={styles.primaryButtonText}>Abrir</Text>
          </TouchableOpacity>
        </View>
      )}

      {hasPermission("cash.movement.create") && (
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Registrar movimiento</Text>
          <View style={styles.typeRow}>
            {MOVEMENT_TYPES.map((t) => (
              <TouchableOpacity
                key={t.code}
                style={[styles.typeButton, movementType === t.code && styles.typeButtonActive]}
                onPress={() => setMovementType(t.code)}
              >
                <Text style={[styles.typeButtonText, movementType === t.code && styles.typeButtonTextActive]}>{t.label}</Text>
              </TouchableOpacity>
            ))}
          </View>
          <TextInput style={styles.input} placeholder="Monto" keyboardType="numeric" value={amount} onChangeText={setAmount} />
          <TextInput style={styles.input} placeholder="Concepto" value={concept} onChangeText={setConcept} />
          <TouchableOpacity style={styles.primaryButton} onPress={handleRegisterMovement}>
            <Text style={styles.primaryButtonText}>Registrar</Text>
          </TouchableOpacity>
        </View>
      )}

      {session && hasPermission("cash.session.close") && (
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Cerrar sesion</Text>
          <TextInput
            style={styles.input}
            placeholder="Monto contado"
            keyboardType="numeric"
            value={closingAmount}
            onChangeText={setClosingAmount}
          />
          <TouchableOpacity style={styles.dangerButton} onPress={handleClose}>
            <Text style={styles.primaryButtonText}>Cerrar</Text>
          </TouchableOpacity>
        </View>
      )}

      {message && <Text style={styles.message}>{message}</Text>}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#f9fafb" },
  content: { padding: 16 },
  header: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 12 },
  title: { fontSize: 20, fontWeight: "600" },
  syncButton: { backgroundColor: "#e5e7eb", paddingHorizontal: 12, paddingVertical: 6, borderRadius: 6 },
  syncButtonText: { fontSize: 12, fontWeight: "600", color: "#374151" },
  card: { backgroundColor: "#fff", borderRadius: 8, padding: 16, marginBottom: 12, borderWidth: 1, borderColor: "#e5e7eb" },
  cardLabel: { color: "#6b7280", fontSize: 13 },
  cardValue: { fontSize: 20, fontWeight: "600", marginTop: 4 },
  cardSub: { color: "#9ca3af", fontSize: 12, marginTop: 2 },
  offlineTag: { color: "#b45309", fontSize: 12, marginBottom: 8, fontWeight: "600" },
  sectionTitle: { fontWeight: "600", fontSize: 15, marginBottom: 8 },
  input: { borderWidth: 1, borderColor: "#e5e7eb", borderRadius: 6, padding: 10, marginBottom: 8 },
  typeRow: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 8 },
  typeButton: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 6, borderWidth: 1, borderColor: "#e5e7eb" },
  typeButtonActive: { backgroundColor: "#2563eb", borderColor: "#2563eb" },
  typeButtonText: { fontSize: 12, color: "#374151" },
  typeButtonTextActive: { color: "#fff", fontWeight: "600" },
  primaryButton: { backgroundColor: "#2563eb", paddingVertical: 10, borderRadius: 8, alignItems: "center" },
  dangerButton: { backgroundColor: "#dc2626", paddingVertical: 10, borderRadius: 8, alignItems: "center" },
  primaryButtonText: { color: "#fff", fontWeight: "600" },
  message: { marginTop: 8, color: "#059669" },
});
