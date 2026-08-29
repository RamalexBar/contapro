const WOMPI_PUBLIC_KEY = import.meta.env.VITE_WOMPI_PUBLIC_KEY as string | undefined;
const WOMPI_ENVIRONMENT: "sandbox" | "production" =
  import.meta.env.VITE_WOMPI_ENVIRONMENT === "production" ? "production" : "sandbox";

/** Mismos dos hosts que usa el backend (wompi-payment-gateway.ts) -- aqui es al reves: estas dos
 * llamadas SI tienen que salir del navegador (no del backend), porque son las unicas dos que
 * tocan el numero de tarjeta en claro. Nunca pasa por nuestro servidor -- ni siquiera de paso --
 * asi el backend nunca queda en alcance PCI para datos de tarjeta. */
const API_BASE_URL: Record<"sandbox" | "production", string> = {
  sandbox: "https://sandbox.wompi.co/v1",
  production: "https://production.wompi.co/v1",
};

export class WompiError extends Error {}

export interface CardInput {
  number: string;
  cvc: string;
  expMonth: string;
  expYear: string;
  cardHolder: string;
}

function baseUrl(): string {
  return API_BASE_URL[WOMPI_ENVIRONMENT];
}

export function isWompiConfigured(): boolean {
  return Boolean(WOMPI_PUBLIC_KEY);
}

/** GET publico (sin body, sin llave privada) -- el "acceptance_token" es el token que representa
 * la aceptacion de terminos/politica de datos exigida por Wompi para crear payment_sources, y
 * cambia cada tanto, no se puede hardcodear. */
export async function fetchAcceptanceToken(): Promise<string> {
  if (!WOMPI_PUBLIC_KEY) throw new WompiError("Wompi no esta configurado en este ambiente");

  const res = await fetch(`${baseUrl()}/merchants/${WOMPI_PUBLIC_KEY}`);
  let json: { data?: { presigned_acceptance?: { acceptance_token?: string } } } = {};
  try {
    json = await res.json();
  } catch {
    // sin cuerpo JSON
  }
  const token = json.data?.presigned_acceptance?.acceptance_token;
  if (!res.ok || !token) throw new WompiError("No se pudo preparar el pago con Wompi, intenta de nuevo");
  return token;
}

/** POST con la LLAVE PUBLICA (no la privada) -- por diseno de Wompi este endpoint es seguro de
 * llamar directo desde el navegador, es la unica forma de tokenizar sin que el numero de tarjeta
 * pase por un servidor propio. */
export async function tokenizeCard(card: CardInput): Promise<string> {
  if (!WOMPI_PUBLIC_KEY) throw new WompiError("Wompi no esta configurado en este ambiente");

  const res = await fetch(`${baseUrl()}/tokens/cards`, {
    method: "POST",
    headers: { Authorization: `Bearer ${WOMPI_PUBLIC_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      number: card.number.replace(/\s+/g, ""),
      cvc: card.cvc,
      exp_month: card.expMonth,
      exp_year: card.expYear,
      card_holder: card.cardHolder,
    }),
  });

  let json: { data?: { id?: string }; error?: { reason?: string; messages?: unknown } } = {};
  try {
    json = await res.json();
  } catch {
    // sin cuerpo JSON
  }
  if (!res.ok || !json.data?.id) {
    const reason = json.error?.reason ?? (json.error?.messages ? JSON.stringify(json.error.messages) : null);
    throw new WompiError(reason ?? "La tarjeta fue rechazada, verifica los datos");
  }
  return json.data.id;
}
