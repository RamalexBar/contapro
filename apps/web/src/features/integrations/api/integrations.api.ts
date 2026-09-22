import { apiFetch } from "../../../lib/api-client";

export interface ApiKeyRecord {
  id: string;
  name: string;
  keyPrefix: string;
  scopes: string[];
  isActive: boolean;
  lastUsedAt: string | null;
  createdByUserId: string;
  createdAt: string;
}

export interface CreateApiKeyResult extends ApiKeyRecord {
  key: string;
}

export interface WebhookSubscriptionRecord {
  id: string;
  url: string;
  eventTypes: string[];
  isActive: boolean;
  createdAt: string;
}

export interface CreateWebhookSubscriptionResult extends WebhookSubscriptionRecord {
  secret: string;
}

export interface WebhookDeliveryRecord {
  id: string;
  webhookSubscriptionId: string;
  eventType: string;
  payload: unknown;
  responseStatus: number | null;
  success: boolean;
  errorMessage: string | null;
  attemptedAt: string;
}

export function listApiKeys(): Promise<{ data: ApiKeyRecord[] }> {
  return apiFetch("/api-keys");
}

export function createApiKey(input: { name: string; scopes: string[] }): Promise<CreateApiKeyResult> {
  return apiFetch("/api-keys", { method: "POST", body: input });
}

export function deactivateApiKey(id: string): Promise<ApiKeyRecord> {
  return apiFetch(`/api-keys/${id}/deactivate`, { method: "POST" });
}

export function listWebhookSubscriptions(): Promise<{ data: WebhookSubscriptionRecord[] }> {
  return apiFetch("/webhook-subscriptions");
}

export function createWebhookSubscription(input: { url: string; eventTypes: string[] }): Promise<CreateWebhookSubscriptionResult> {
  return apiFetch("/webhook-subscriptions", { method: "POST", body: input });
}

export function deactivateWebhookSubscription(id: string): Promise<WebhookSubscriptionRecord> {
  return apiFetch(`/webhook-subscriptions/${id}/deactivate`, { method: "POST" });
}

export function listWebhookDeliveries(webhookSubscriptionId: string): Promise<{ data: WebhookDeliveryRecord[] }> {
  return apiFetch(`/webhook-subscriptions/${webhookSubscriptionId}/deliveries`);
}

export function resendWebhookDelivery(id: string): Promise<void> {
  return apiFetch(`/webhook-deliveries/${id}/resend`, { method: "POST" });
}

// ---- Proveedor tecnologico DIAN (ver modules/electronic-invoicing/README.md, seccion
// "Proveedor tecnologico (Factus API)") ----

export interface DianProviderSettings {
  provider: "DIRECT" | "FACTUS";
  hasFactusCredentials: boolean;
}

export interface FactusCredentialsInput {
  clientId: string;
  clientSecret: string;
  email: string;
  password: string;
}

export function getDianProviderSettings(): Promise<DianProviderSettings> {
  return apiFetch("/electronic-invoicing/provider-settings");
}

export function setDianProviderSettings(input: {
  provider: "DIRECT" | "FACTUS";
  factusCredentials?: FactusCredentialsInput;
}): Promise<void> {
  return apiFetch("/electronic-invoicing/provider-settings", { method: "PUT", body: input });
}

// ---- Consumo de documentos DIAN del mes vs. tope del plan (decision 2026-09-21, ver memoria
// factus-pricing-and-caps) ----

export interface ElectronicDocumentUsage {
  documentsThisMonth: number;
  planCode: string | null;
  planName: string | null;
  monthlyLimit: number | null;
}

export function getElectronicDocumentUsage(): Promise<ElectronicDocumentUsage> {
  return apiFetch("/electronic-invoicing/document-usage");
}
