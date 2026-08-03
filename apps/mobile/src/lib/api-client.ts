import { useAuthStore } from "../store/useAuthStore";

// En un dispositivo fisico/emulador, "localhost" no apunta a la maquina de desarrollo:
// usar la IP de la maquina (ej. 192.168.x.x) o `expo start --tunnel`. Configurable via
// variable de entorno de Expo (EXPO_PUBLIC_API_BASE_URL) en app.config.ts si se requiere.
const BASE_URL = process.env.EXPO_PUBLIC_API_BASE_URL ?? "http://localhost:4000/api";

interface RequestOptions {
  method?: "GET" | "POST" | "PATCH" | "PUT" | "DELETE";
  body?: unknown;
  retry?: boolean;
}

/**
 * Mismo patron que apps/web/src/lib/api-client.ts: si el accessToken persistido ya expiro (dura
 * 15 minutos, la sesion persistida en disco puede ser de hace mucho mas), intenta refrescarlo una
 * vez con el refreshToken (dura 30 dias) antes de rendirse. Si el refresh tambien falla (refresh
 * token vencido/revocado), limpia la sesion. Se usa aqui en el flujo 401-y-reintenta, y tambien
 * la llama RootNavigator proactivamente al abrir la app (antes de decidir Login vs Dashboard),
 * ya que un accessToken de una sesion persistida de hace rato casi siempre esta vencido.
 */
export async function refreshAccessToken(): Promise<boolean> {
  const { refreshToken, user, setSession, clearSession } = useAuthStore.getState();
  if (!refreshToken) return false;
  try {
    const res = await fetch(`${BASE_URL}/auth/refresh`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ refreshToken }),
    });
    if (!res.ok) throw new Error("refresh failed");
    const data = await res.json();
    if (user) setSession(data.accessToken, data.refreshToken, user);
    return true;
  } catch {
    clearSession();
    return false;
  }
}

export async function apiFetch<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const { accessToken, user } = useAuthStore.getState();

  const res = await fetch(`${BASE_URL}${path}`, {
    method: options.method ?? "GET",
    headers: {
      "Content-Type": "application/json",
      ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
      ...(user?.branchId ? { "x-branch-id": user.branchId } : {}),
    },
    body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
  });

  if (res.status === 401 && options.retry !== false) {
    const refreshed = await refreshAccessToken();
    if (refreshed) return apiFetch<T>(path, { ...options, retry: false });
  }

  if (!res.ok) {
    const payload = await res.json().catch(() => ({}));
    throw new Error(payload.message ?? res.statusText);
  }
  if (res.status === 204) return undefined as T;
  return res.json();
}
