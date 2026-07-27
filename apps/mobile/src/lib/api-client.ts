import { useAuthStore } from "../store/useAuthStore";

// En un dispositivo fisico/emulador, "localhost" no apunta a la maquina de desarrollo:
// usar la IP de la maquina (ej. 192.168.x.x) o `expo start --tunnel`. Configurable via
// variable de entorno de Expo (EXPO_PUBLIC_API_BASE_URL) en app.config.ts si se requiere.
const BASE_URL = process.env.EXPO_PUBLIC_API_BASE_URL ?? "http://localhost:4000/api";

interface RequestOptions {
  method?: "GET" | "POST" | "PATCH" | "PUT" | "DELETE";
  body?: unknown;
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

  if (!res.ok) {
    const payload = await res.json().catch(() => ({}));
    throw new Error(payload.message ?? res.statusText);
  }
  if (res.status === 204) return undefined as T;
  return res.json();
}
