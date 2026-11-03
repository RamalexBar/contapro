import { platformApiFetch } from "../lib/platform-api-client";
import type { PlatformAdminUser } from "../hooks/usePlatformAuthStore";

export interface LoginPlatformAdminResult {
  accessToken: string;
  platformAdmin: PlatformAdminUser;
}

export function loginPlatformAdmin(input: { email: string; password: string }): Promise<LoginPlatformAdminResult> {
  return platformApiFetch("/admin/auth/login", { method: "POST", body: input });
}

export interface PlanRecord {
  id: string;
  code: string;
  name: string;
  priceMonthly: number;
  priceYearly: number;
  maxBranches: number;
  maxUsers: number;
  features: Record<string, unknown>;
  isActive: boolean;
  createdAt: string;
}

export interface CreatePlanInput {
  code: string;
  name: string;
  priceMonthly: number;
  priceYearly: number;
  maxBranches: number;
  maxUsers: number;
}

export function listPlans(): Promise<{ data: PlanRecord[] }> {
  return platformApiFetch("/admin/plans");
}

export function createPlan(input: CreatePlanInput): Promise<PlanRecord> {
  return platformApiFetch("/admin/plans", { method: "POST", body: { ...input, features: {} } });
}

export type SubscriptionStatus = "TRIALING" | "ACTIVE" | "GRACE_PERIOD" | "SUSPENDED" | "CANCELLED";

export interface SubscriptionPaymentRecord {
  id: string;
  amount: number;
  method: string;
  reference: string | null;
  status: string;
  paidAt: string | null;
  createdAt: string;
}

export interface SubscriptionRecord {
  id: string;
  companyId: string;
  planId: string;
  status: SubscriptionStatus;
  billingCycle: string;
  startDate: string;
  currentPeriodEnd: string;
  graceEndsAt: string | null;
  cancelledAt: string | null;
  createdAt: string;
  companyName: string;
  planName: string;
  planCode: string;
  // Ultimo pago CONFIRMED (el mas reciente), null si todavia no ha pagado ninguno (ej. TRIAL).
  lastPayment: SubscriptionPaymentRecord | null;
}

export interface CreateSubscriptionInput {
  companyId: string;
  planId: string;
  status: SubscriptionStatus;
  billingCycle: "MONTHLY" | "YEARLY";
  startDate: string;
  currentPeriodEnd: string;
}

export function listSubscriptions(): Promise<{ data: SubscriptionRecord[] }> {
  return platformApiFetch("/admin/subscriptions");
}

export function createSubscription(input: CreateSubscriptionInput): Promise<SubscriptionRecord> {
  return platformApiFetch("/admin/subscriptions", { method: "POST", body: input });
}

export function registerSubscriptionPayment(
  id: string,
  input: { amount: number; method: string; reference?: string }
): Promise<{ subscription: SubscriptionRecord; payment: unknown }> {
  return platformApiFetch(`/admin/subscriptions/${id}/payments`, { method: "POST", body: input });
}

export interface CompanyWithSubscriptionRecord {
  companyId: string;
  companyName: string;
  nit: string;
  isActive: boolean;
  subscriptionStatus: SubscriptionStatus | null;
  planName: string | null;
  currentPeriodEnd: string | null;
  graceEndsAt: string | null;
  registeredAt: string;
  planCode: string | null;
  electronicInvoicingProvider: string;
  factusActivationRequestedAt: string | null;
}

/** Mensajes del formulario de contacto de contapro.com.co. */
export interface ContactMessage {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  company: string | null;
  message: string;
  source: string;
  createdAt: string;
  handledAt: string | null;
}

export function listContactMessages(): Promise<{ data: ContactMessage[] }> {
  return platformApiFetch("/admin/contact-messages");
}

export function setContactMessageHandled(id: string, handled: boolean): Promise<void> {
  return platformApiFetch(`/admin/contact-messages/${id}/handled`, { method: "PATCH", body: { handled } });
}

export function listCompanies(): Promise<{ data: CompanyWithSubscriptionRecord[] }> {
  return platformApiFetch("/admin/companies");
}

/** Archivar (nadie entra, no se cobra; no se borra nada) o reactivar una empresa. */
export function setCompanyArchived(companyId: string, archived: boolean): Promise<void> {
  return platformApiFetch(`/admin/companies/${companyId}/archived`, { method: "PATCH", body: { archived } });
}

/** Borrar definitivamente una empresa archivada (hay que escribir su nombre exacto). */
export function deleteCompany(companyId: string, confirmName: string): Promise<{ deleted: number }> {
  return platformApiFetch(`/admin/companies/${companyId}`, { method: "DELETE", body: { confirmName } });
}

export interface SaasDashboardStats {
  companiesByStatus: Record<SubscriptionStatus, number>;
  upcomingRenewals: number;
  monthlyRevenueConfirmed: number;
}

export function getSaasDashboard(): Promise<SaasDashboardStats> {
  return platformApiFetch("/admin/dashboard");
}

export type FactusActivationMediaType = "application/pdf" | "image/jpeg" | "image/png";

export interface FactusActivationAttachmentInput {
  filename: string;
  mediaType: FactusActivationMediaType;
  base64: string;
}

export interface SendFactusActivationRequestInput {
  integrationVersion: "v1" | "v2";
  rut: FactusActivationAttachmentInput;
  legalRepCertificate: FactusActivationAttachmentInput | null;
  legalRepId: FactusActivationAttachmentInput;
  purchaseProof: FactusActivationAttachmentInput;
  logo: FactusActivationAttachmentInput;
}

export function sendFactusActivationRequest(companyId: string, input: SendFactusActivationRequestInput): Promise<void> {
  return platformApiFetch(`/admin/companies/${companyId}/factus-activation-request`, { method: "POST", body: input });
}

export interface PlatformAdminRecord {
  id: string;
  email: string;
  fullName: string;
  isActive: boolean;
  createdAt: string;
}

export function listPlatformAdmins(): Promise<{ data: PlatformAdminRecord[] }> {
  return platformApiFetch("/admin/platform-admins");
}

export function createPlatformAdmin(input: { email: string; password: string; fullName: string }): Promise<PlatformAdminRecord> {
  return platformApiFetch("/admin/platform-admins", { method: "POST", body: input });
}

export function setPlatformAdminActive(id: string, isActive: boolean): Promise<PlatformAdminRecord> {
  return platformApiFetch(`/admin/platform-admins/${id}`, { method: "PATCH", body: { isActive } });
}

export function setPlatformAdminPassword(id: string, password: string): Promise<void> {
  return platformApiFetch(`/admin/platform-admins/${id}/password`, { method: "PUT", body: { password } });
}
