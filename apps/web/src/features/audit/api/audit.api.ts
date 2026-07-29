import { apiFetch } from "../../../lib/api-client";

export interface AuditLogEntry {
  id: string;
  branchId: string | null;
  userId: string | null;
  action: string;
  entityType: string;
  entityId: string;
  description: string;
  metadata: Record<string, unknown> | null;
  createdAt: string;
}

export function listAuditLogs(filter?: {
  entityType?: string;
  entityId?: string;
  action?: string;
  take?: number;
  skip?: number;
}): Promise<{ data: AuditLogEntry[] }> {
  const params = new URLSearchParams();
  if (filter?.entityType) params.set("entityType", filter.entityType);
  if (filter?.entityId) params.set("entityId", filter.entityId);
  if (filter?.action) params.set("action", filter.action);
  if (filter?.take) params.set("take", String(filter.take));
  if (filter?.skip) params.set("skip", String(filter.skip));
  const query = params.toString();
  return apiFetch(`/audit-logs${query ? `?${query}` : ""}`);
}
