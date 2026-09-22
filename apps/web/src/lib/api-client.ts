import { useAuthStore } from "../features/auth/hooks/useAuthStore";

export const BASE_URL = import.meta.env.VITE_API_BASE_URL ?? "http://localhost:4000/api";

export class ApiError extends Error {
  constructor(public status: number, message: string, public details?: unknown, public code?: string) {
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
    let payload: { message?: string; details?: unknown; error?: string } = {};
    try {
      payload = await res.json();
    } catch {
      // sin cuerpo JSON
    }
    throw new ApiError(res.status, payload.message ?? res.statusText, payload.details, payload.error);
  }

  if (res.status === 204) return undefined as T;
  return res.json();
}

/** Abre un PDF generado por el backend en una pestana nueva, listo para imprimir con Ctrl+P --
 * el endpoint exige el token en el header Authorization, asi que un <a href> directo no sirve.
 * Usado por todos los botones "Imprimir"/"Ver PDF" (comprobante contable, cotizacion, orden de
 * compra, recibos de pago, gasto, liquidacion de comisiones, factura electronica, tirilla POS).
 *
 * `window.open` despues de un `await fetch(...)` puede volver `null` si el navegador decide que
 * ya paso demasiado tiempo desde el clic original para seguir considerandolo un gesto directo del
 * usuario (bloqueo silencioso de ventana emergente -- no todos los navegadores/extensiones
 * muestran el icono nativo de "bloqueado" en la barra de direcciones). Sin este chequeo, un
 * bloqueo o un fetch fallido no mostraban ningun error: el boton simplemente no hacia nada visible
 * (bug real reportado en ManualInvoicePage.tsx, 2026-09-21). Se propaga como excepcion para que el
 * caller (via useMutation) pueda mostrarlo en un Alert. */
export async function openPdfInNewTab(path: string): Promise<void> {
  const { accessToken } = useAuthStore.getState();
  const res = await fetch(`${BASE_URL}${path}`, {
    headers: accessToken ? { Authorization: `Bearer ${accessToken}` } : {},
  });
  if (!res.ok) throw new Error("No se pudo generar el PDF");
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const opened = window.open(url, "_blank");
  if (!opened) {
    URL.revokeObjectURL(url);
    throw new Error("El navegador bloqueó la ventana emergente del PDF. Habilitá las ventanas emergentes para este sitio e intentá de nuevo.");
  }
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
}
