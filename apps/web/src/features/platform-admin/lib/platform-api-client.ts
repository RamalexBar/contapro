import { usePlatformAuthStore } from "../hooks/usePlatformAuthStore";
import { ApiError } from "../../../lib/api-client";

const BASE_URL = import.meta.env.VITE_API_BASE_URL ?? "http://localhost:4000/api";

interface RequestOptions {
  method?: "GET" | "POST" | "PATCH" | "PUT" | "DELETE";
  body?: unknown;
}

/** Analogo a lib/api-client.ts pero para el panel de plataforma: token separado
 * (usePlatformAuthStore), sin header x-branch-id (no aplica, no hay tenant), y sin logica de
 * refresh (el JWT de plataforma no tiene refresh token, ver usePlatformAuthStore.ts). */
export async function platformApiFetch<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const { accessToken, clearSession } = usePlatformAuthStore.getState();

  const res = await fetch(`${BASE_URL}${path}`, {
    method: options.method ?? "GET",
    headers: {
      "Content-Type": "application/json",
      ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
    },
    body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
  });

  if (res.status === 401) {
    clearSession();
  }

  if (!res.ok) {
    let payload: { message?: string; details?: unknown } = {};
    try {
      payload = await res.json();
    } catch {
      // sin cuerpo JSON
    }
    throw new ApiError(res.status, payload.message ?? res.statusText, payload.details);
  }

  if (res.status === 204) return undefined as T;
  return res.json();
}
