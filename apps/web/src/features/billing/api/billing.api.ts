import { apiFetch } from "../../../lib/api-client";

export interface PlanRecord {
  id: string;
  code: string;
  name: string;
  priceMonthly: number;
  priceYearly: number;
  maxBranches: number;
  maxUsers: number;
  isActive: boolean;
}

export interface SubscriptionRecord {
  id: string;
  status: "TRIALING" | "ACTIVE" | "GRACE_PERIOD" | "SUSPENDED" | "CANCELLED";
  billingCycle: string;
  currentPeriodEnd: string;
  graceEndsAt: string | null;
  autoRenew: boolean;
  cardLastFour: string | null;
  cardBrand: string | null;
}

export interface OwnSubscriptionResponse {
  subscription: SubscriptionRecord;
  plan: PlanRecord;
  availablePlans: PlanRecord[];
}

export interface CreateCheckoutInput {
  customerEmail: string;
  redirectUrl?: string;
  planId?: string;
}

export interface CreateCheckoutResponse {
  checkoutUrl: string;
  reference: string;
  amount: number;
}

export function getOwnSubscription(): Promise<OwnSubscriptionResponse> {
  return apiFetch("/subscription");
}

export function createOwnCheckout(input: CreateCheckoutInput): Promise<CreateCheckoutResponse> {
  return apiFetch("/subscription/checkout", { method: "POST", body: input });
}

export interface SavePaymentSourceInput {
  cardToken: string;
  customerEmail: string;
  acceptanceToken: string;
}

export function savePaymentSource(input: SavePaymentSourceInput): Promise<SubscriptionRecord> {
  return apiFetch("/subscription/payment-source", { method: "POST", body: input });
}

export function disableAutoRenew(): Promise<SubscriptionRecord> {
  return apiFetch("/subscription/disable-auto-renew", { method: "POST" });
}
