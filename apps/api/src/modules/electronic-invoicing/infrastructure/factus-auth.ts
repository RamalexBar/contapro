import { env } from "../../../config/env";

/** Las 4 credenciales OAuth2 "password grant" de Factus, tal como se guardan (cifradas, ver
 * set-electronic-invoicing-provider.use-case.ts) en Company.factusCredentialsEncrypted junto al
 * numberingRangeId auto-provisionado. */
export interface FactusOAuthCredentials {
  clientId: string;
  clientSecret: string;
  email: string;
  password: string;
}

interface FactusAuthResponse {
  access_token?: string;
  token_type?: string;
  expires_in?: number;
}

/**
 * Autenticacion OAuth2 "password grant" de Factus, compartida por factus-invoicing-client.ts
 * (envio de facturas) y factus-account-provisioning.service.ts (crear rango de numeracion +
 * subir logo al activar el proveedor). Sin cache/refresh -- se pide un access_token nuevo en
 * cada llamada, mismo criterio ya documentado en factus-invoicing-client.ts.
 */
export async function authenticateFactus(credentials: FactusOAuthCredentials): Promise<string> {
  const body = new URLSearchParams({
    grant_type: "password",
    client_id: credentials.clientId,
    client_secret: credentials.clientSecret,
    username: credentials.email,
    password: credentials.password,
  });

  const res = await fetch(`${env.FACTUS_BASE_URL}/oauth/token`, {
    method: "POST",
    headers: { Accept: "application/json", "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });

  const raw = await res.text();
  if (!res.ok) {
    throw new Error(`Factus rechazo la autenticacion (status ${res.status}): ${raw.slice(0, 500)}`);
  }

  let parsed: FactusAuthResponse;
  try {
    parsed = JSON.parse(raw) as FactusAuthResponse;
  } catch {
    throw new Error(`Factus devolvio una respuesta no-JSON al autenticar (status ${res.status}): ${raw.slice(0, 500)}`);
  }

  if (!parsed.access_token) {
    throw new Error(`Factus no devolvio access_token al autenticar: ${raw.slice(0, 500)}`);
  }
  return parsed.access_token;
}
