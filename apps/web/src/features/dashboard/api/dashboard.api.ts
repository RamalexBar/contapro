import type { DashboardMetrics } from "@erp/shared-types";
import { apiFetch } from "../../../lib/api-client";

export function getDashboardMetrics(): Promise<DashboardMetrics> {
  return apiFetch<DashboardMetrics>("/dashboard/metrics");
}
