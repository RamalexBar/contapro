import { useState } from "react";
import { StyleSheet, Text, TextInput, TouchableOpacity, View } from "react-native";
import type { AuthTokensResponse, LoginInput } from "@erp/shared-types";
import { apiFetch } from "../../lib/api-client";
import { useAuthStore } from "../../store/useAuthStore";

export function LoginScreen({ navigation }: { navigation: { replace: (name: string) => void } }) {
  const setSession = useAuthStore((s) => s.setSession);
  const [email, setEmail] = useState("admin@demo.com");
  const [password, setPassword] = useState("Demo1234!");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleLogin() {
    setLoading(true);
    setError(null);
    try {
      const body: LoginInput = { email, password };
      const result = await apiFetch<AuthTokensResponse>("/auth/login", { method: "POST", body });
      setSession(result.accessToken, result.refreshToken, result.user);
      navigation.replace("Dashboard");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error de conexion");
    } finally {
      setLoading(false);
    }
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>ERP SaaS Colombia</Text>
      <TextInput style={styles.input} value={email} onChangeText={setEmail} autoCapitalize="none" placeholder="Correo" />
      <TextInput
        style={styles.input}
        value={password}
        onChangeText={setPassword}
        secureTextEntry
        placeholder="Contraseña"
      />
      {error && <Text style={styles.error}>{error}</Text>}
      <TouchableOpacity style={styles.button} onPress={handleLogin} disabled={loading}>
        <Text style={styles.buttonText}>{loading ? "Ingresando..." : "Ingresar"}</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: "center", padding: 24, backgroundColor: "#f9fafb" },
  title: { fontSize: 22, fontWeight: "600", marginBottom: 24, textAlign: "center" },
  input: { borderWidth: 1, borderColor: "#d1d5db", borderRadius: 8, padding: 12, marginBottom: 12, backgroundColor: "#fff" },
  button: { backgroundColor: "#2563eb", borderRadius: 8, padding: 14, alignItems: "center" },
  buttonText: { color: "#fff", fontWeight: "600" },
  error: { color: "#dc2626", marginBottom: 12 },
});
