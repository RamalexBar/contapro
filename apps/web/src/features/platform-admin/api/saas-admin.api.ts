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
}

export function listCompanies(): Promise<{ data: CompanyWithSubscriptionRecord[] }> {
  return platformApiFetch("/admin/companies");
}

export interface SaasDashboardStats {
  companiesByStatus: Record<SubscriptionStatus, number>;
  upcomingRenewals: number;
  monthlyRevenueConfirmed: number;
}

export function getSaasDashboard(): Promise<SaasDashboardStats> {
  return platformApiFetch("/admin/dashboard");
}
