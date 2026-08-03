import { Prisma } from "@erp/database";
import { prisma } from "../../../shared/prisma/prisma-client";
import { getTenantContext } from "../../../shared/context/request-context";
import type {
  CreateOutboxPendingData,
  ISyncRepository,
  PulledProduct,
  SyncOutboxRecord,
  SyncOutboxStatus,
  UpsertDeviceData,
} from "../domain/sync.repository";

function toOutboxRecord(row: {
  id: string;
  clientEventId: string;
  entityType: string;
  entityId: string | null;
  operation: string;
  payload: unknown;
  status: string;
  errorMessage: string | null;
  syncedAt: Date | null;
}): SyncOutboxRecord {
  return {
    id: row.id,
    clientEventId: row.clientEventId,
    entityType: row.entityType,
    entityId: row.entityId,
    operation: row.operation,
    payload: row.payload,
    status: row.status as SyncOutboxStatus,
    errorMessage: row.errorMessage,
    syncedAt: row.syncedAt,
  };
}

export class PrismaSyncRepository implements ISyncRepository {
  async upsertDevice(data: UpsertDeviceData): Promise<void> {
    const companyId = getTenantContext().companyId;
    await prisma.syncDevice.upsert({
      where: { companyId_deviceIdentifier: { companyId, deviceIdentifier: data.deviceIdentifier } },
      create: {
        companyId,
        branchId: data.branchId,
        userId: data.userId,
        deviceIdentifier: data.deviceIdentifier,
        platform: data.platform,
      },
      update: { branchId: data.branchId, userId: data.userId, platform: data.platform },
    });
  }

  async touchDeviceLastSync(deviceIdentifier: string): Promise<void> {
    const companyId = getTenantContext().companyId;
    await prisma.syncDevice.updateMany({
      where: { companyId, deviceIdentifier },
      data: { lastSyncAt: new Date() },
    });
  }

  async findOutboxByClientEventId(clientEventId: string): Promise<SyncOutboxRecord | null> {
    const companyId = getTenantContext().companyId;
    const row = await prisma.syncOutbox.findUnique({
      where: { companyId_clientEventId: { companyId, clientEventId } },
    });
    return row ? toOutboxRecord(row) : null;
  }

  async createOutboxPending(data: CreateOutboxPendingData): Promise<SyncOutboxRecord> {
    const companyId = getTenantContext().companyId;
    const row = await prisma.syncOutbox.create({
      data: {
        companyId,
        branchId: data.branchId,
        clientEventId: data.clientEventId,
        entityType: data.entityType,
        operation: data.operation,
        payload: data.payload as Prisma.InputJsonValue,
        originDeviceId: data.originDeviceId,
        status: "PENDING",
      },
    });
    return toOutboxRecord(row);
  }

  // updateMany (no update): SyncOutbox.update({where:{id}}) por si solo no queda scoped al
  // tenant -- estos 3 metodos siempre corren dentro de una request HTTP autenticada (POST
  // /sync/push), asi que getTenantContext() nunca lanza aqui.
  async markOutboxSynced(id: string, entityId: string): Promise<void> {
    const companyId = getTenantContext().companyId;
    await prisma.syncOutbox.updateMany({
      where: { id, companyId },
      data: { status: "SYNCED", entityId, syncedAt: new Date(), errorMessage: null },
    });
  }

  async markOutboxError(id: string, message: string): Promise<void> {
    const companyId = getTenantContext().companyId;
    await prisma.syncOutbox.updateMany({
      where: { id, companyId },
      data: { status: "ERROR", errorMessage: message },
    });
  }

  async createConflictLog(outboxEventId: string, reason: string): Promise<void> {
    const companyId = getTenantContext().companyId;
    await prisma.$transaction([
      prisma.syncOutbox.updateMany({ where: { id: outboxEventId, companyId }, data: { status: "CONFLICT" } }),
      prisma.syncConflictLog.create({ data: { outboxEventId, conflictReason: reason } }),
    ]);
  }

  async listProductsChangedSince(since: Date | null): Promise<PulledProduct[]> {
    const rows = await prisma.product.findMany({
      where: { isActive: true, ...(since ? { updatedAt: { gt: since } } : {}) },
      include: { barcodes: { take: 1 } },
      orderBy: { updatedAt: "asc" },
      take: 500,
    });
    return rows.map((row) => ({
      id: row.id,
      sku: row.sku,
      name: row.name,
      currentPrice: Number(row.currentPrice),
      currentCost: Number(row.currentCost),
      barcode: row.barcodes[0]?.code ?? null,
      updatedAt: row.updatedAt,
    }));
  }
}
