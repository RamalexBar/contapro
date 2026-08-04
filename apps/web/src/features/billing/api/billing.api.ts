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
