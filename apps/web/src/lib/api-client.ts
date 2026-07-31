import { useAuthStore } from "../features/auth/hooks/useAuthStore";

export const BASE_URL = import.meta.env.VITE_API_BASE_URL ?? "http://localhost:4000/api";

export class ApiError extends Error {
  constructor(public status: number, message: string, public details?: unknown) {
    super(message);
  }
}

async function refreshAccessToken(): Promise<boolean> {
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

interface RequestOptions {
  method?: "GET" | "POST" | "PATCH" | "PUT" | "DELETE";
  body?: unknown;
  retry?: boolean;
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
