import { describe, expect, it } from "vitest";
import type { CreateSaleInput } from "@erp/shared-types";
import { tenantStorage } from "../../../../shared/context/request-context";
import type { SaleRecord } from "../../../pos/sale/domain/sale.repository";
import type {
  CreateOutboxPendingData,
  ISyncRepository,
  PulledProduct,
  SyncOutboxRecord,
  SyncOutboxStatus,
  UpsertDeviceData,
} from "../../domain/sync.repository";
import { ICashMovementCreator, ISaleCreator, PushSyncEventsUseCase } from "./push-sync-events.use-case";

function makeSalePayload(overrides: Partial<CreateSaleInput> = {}): CreateSaleInput {
  return {
    branchId: "11111111-1111-1111-1111-111111111111",
    items: [{ productId: "22222222-2222-2222-2222-222222222222", quantity: 2, discountPercent: 0 }],
    payments: [{ method: "CASH", amount: 10000 }],
    withholdings: [],
    currency: "COP",
    exchangeRate: 1,
    ...overrides,
  };
}

function makeSaleRecord(id: string): SaleRecord {
  return {
    id,
    companyId: "company-1",
    branchId: "branch-1",
    number: 1,
    customerId: null,
    sellerUserId: "user-1",
    status: "COMPLETED",
    paymentStatus: "PAID",
    subtotal: 10000,
    discountTotal: 0,
    taxTotal: 1900,
    total: 11900,
    retentionTotal: 0,
    cufe: null,
    cude: null,
    invoiceXmlUrl: null,
    accountReceivableId: null,
    currency: "COP",
    exchangeRate: 1,
    foreignTotal: null,
    priceListId: null,
    createdAt: new Date(),
    withholdings: [],
    items: [],
    payments: [],
    costTotal: 0,
  };
}

class FakeSyncRepository implements ISyncRepository {
  outbox = new Map<string, SyncOutboxRecord>();
  conflicts: Array<{ outboxEventId: string; reason: string }> = [];
  devices: UpsertDeviceData[] = [];
  touchedDevices: string[] = [];
  private nextId = 1;

  async upsertDevice(data: UpsertDeviceData): Promise<void> {
    this.devices.push(data);
  }
  async touchDeviceLastSync(deviceIdentifier: string): Promise<void> {
    this.touchedDevices.push(deviceIdentifier);
  }
  async findOutboxByClientEventId(clientEventId: string): Promise<SyncOutboxRecord | null> {
    return this.outbox.get(clientEventId) ?? null;
  }
  async createOutboxPending(data: CreateOutboxPendingData): Promise<SyncOutboxRecord> {
    const record: SyncOutboxRecord = {
      id: `outbox-${this.nextId++}`,
      clientEventId: data.clientEventId,
      entityType: data.entityType,
      entityId: null,
      operation: data.operation,
      payload: data.payload,
      status: "PENDING",
      errorMessage: null,
      syncedAt: null,
    };
    this.outbox.set(data.clientEventId, record);
    return record;
  }
  async markOutboxSynced(id: string, entityId: string): Promise<void> {
    this.updateByOutboxId(id, { status: "SYNCED", entityId, syncedAt: new Date() });
  }
  async markOutboxError(id: string, message: string): Promise<void> {
    this.updateByOutboxId(id, { status: "ERROR", errorMessage: message });
  }
  async createConflictLog(outboxEventId: string, reason: string): Promise<void> {
    this.conflicts.push({ outboxEventId, reason });
    this.updateByOutboxId(outboxEventId, { status: "CONFLICT" });
  }
  async listProductsChangedSince(): Promise<PulledProduct[]> {
    return [];
  }

  private updateByOutboxId(id: string, patch: Partial<SyncOutboxRecord> & { status: SyncOutboxStatus }) {
    for (const [key, record] of this.outbox) {
      if (record.id === id) {
        this.outbox.set(key, { ...record, ...patch });
        return;
      }
    }
  }
}

class FakeSaleCreator implements ISaleCreator {
  calls: CreateSaleInput[] = [];
  shouldFail = false;

  async execute(input: CreateSaleInput): Promise<SaleRecord> {
    this.calls.push(input);
    if (this.shouldFail) throw new Error("stock insuficiente");
    return makeSaleRecord(`sale-${this.calls.length}`);
  }
}

class FakeCashMovementCreator implements ICashMovementCreator {
  calls: Array<{ cashSessionId: string; input: { type: string; amount: number; concept: string } }> = [];
  shouldFail = false;

  async execute(cashSessionId: string, input: { type: string; amount: number; concept: string }): Promise<{ id: string }> {
    this.calls.push({ cashSessionId, input });
    if (this.shouldFail) throw new Error("La caja ya esta cerrada");
    return { id: `movement-${this.calls.length}` };
  }
}

const ALL_PERMISSIONS = new Set(["sale.create", "cash.movement.create"]);

function withTenantContext<T>(permissions: Set<string>, fn: () => Promise<T>): Promise<T> {
  return tenantStorage.run(
    { companyId: "company-1", branchId: null, userId: "user-1", roles: [], permissions },
    fn
  );
}

describe("PushSyncEventsUseCase", () => {
  it("creates the sale and marks the outbox event SYNCED", async () => {
    const syncRepo = new FakeSyncRepository();
    const saleCreator = new FakeSaleCreator();
    const useCase = new PushSyncEventsUseCase(syncRepo, saleCreator, new FakeCashMovementCreator());

    const results = await withTenantContext(ALL_PERMISSIONS, () =>
      useCase.execute({
        deviceIdentifier: "device-1",
        platform: "ANDROID",
        branchId: "branch-1",
        userId: "user-1",
        events: [{ clientEventId: "evt-1", entityType: "SALE", payload: makeSalePayload() }],
      })
    );

    expect(results).toEqual([{ clientEventId: "evt-1", status: "SYNCED", entityId: "sale-1" }]);
    expect(saleCreator.calls).toHaveLength(1);
    expect(syncRepo.outbox.get("evt-1")?.status).toBe("SYNCED");
    expect(syncRepo.touchedDevices).toContain("device-1");
  });

  it("does not recreate the sale when the same clientEventId is pushed again", async () => {
    const syncRepo = new FakeSyncRepository();
    const saleCreator = new FakeSaleCreator();
    const useCase = new PushSyncEventsUseCase(syncRepo, saleCreator, new FakeCashMovementCreator());
    const event = { clientEventId: "evt-1", entityType: "SALE", payload: makeSalePayload() };

    await withTenantContext(ALL_PERMISSIONS, () =>
      useCase.execute({ deviceIdentifier: "device-1", platform: "ANDROID", branchId: "branch-1", userId: "user-1", events: [event] })
    );
    const secondRun = await withTenantContext(ALL_PERMISSIONS, () =>
      useCase.execute({
        deviceIdentifier: "device-1",
        platform: "ANDROID",
        branchId: "branch-1",
        userId: "user-1",
        events: [event],
      })
    );

    expect(saleCreator.calls).toHaveLength(1);
    expect(secondRun).toEqual([{ clientEventId: "evt-1", status: "SYNCED", entityId: "sale-1" }]);
  });

  it("treats a retry as idempotent even if the stored payload's key order differs (Postgres JSONB does not preserve it)", async () => {
    const syncRepo = new FakeSyncRepository();
    const saleCreator = new FakeSaleCreator();
    const useCase = new PushSyncEventsUseCase(syncRepo, saleCreator, new FakeCashMovementCreator());
    const original = makeSalePayload();
    // Mismo contenido, orden de claves distinto -- simula lo que Postgres JSONB devuelve al
    // releer el payload guardado (ver stableStringify en el caso de uso).
    const reordered: CreateSaleInput = {
      payments: original.payments,
      items: original.items.map((item) => ({ discountPercent: item.discountPercent, quantity: item.quantity, productId: item.productId })),
      branchId: original.branchId,
      withholdings: original.withholdings,
      currency: original.currency,
      exchangeRate: original.exchangeRate,
    };

    await withTenantContext(ALL_PERMISSIONS, () =>
      useCase.execute({
        deviceIdentifier: "device-1",
        platform: "ANDROID",
        branchId: "branch-1",
        userId: "user-1",
        events: [{ clientEventId: "evt-1", entityType: "SALE", payload: original }],
      })
    );
    const secondRun = await withTenantContext(ALL_PERMISSIONS, () =>
      useCase.execute({
        deviceIdentifier: "device-1",
        platform: "ANDROID",
        branchId: "branch-1",
        userId: "user-1",
        events: [{ clientEventId: "evt-1", entityType: "SALE", payload: reordered }],
      })
    );

    expect(saleCreator.calls).toHaveLength(1);
    expect(secondRun[0].status).toBe("SYNCED");
  });

  it("flags a conflict when the same clientEventId arrives with a different payload", async () => {
    const syncRepo = new FakeSyncRepository();
    const saleCreator = new FakeSaleCreator();
    const useCase = new PushSyncEventsUseCase(syncRepo, saleCreator, new FakeCashMovementCreator());

    await withTenantContext(ALL_PERMISSIONS, () =>
      useCase.execute({
        deviceIdentifier: "device-1",
        platform: "ANDROID",
        branchId: "branch-1",
        userId: "user-1",
        events: [{ clientEventId: "evt-1", entityType: "SALE", payload: makeSalePayload({ items: [{ productId: "22222222-2222-2222-2222-222222222222", quantity: 2, discountPercent: 0 }] }) }],
      })
    );
    const results = await withTenantContext(ALL_PERMISSIONS, () =>
      useCase.execute({
        deviceIdentifier: "device-1",
        platform: "ANDROID",
        branchId: "branch-1",
        userId: "user-1",
        events: [{ clientEventId: "evt-1", entityType: "SALE", payload: makeSalePayload({ items: [{ productId: "22222222-2222-2222-2222-222222222222", quantity: 99, discountPercent: 0 }] }) }],
      })
    );

    expect(results[0].status).toBe("CONFLICT");
    expect(saleCreator.calls).toHaveLength(1);
    expect(syncRepo.conflicts).toHaveLength(1);
  });

  it("marks the outbox event ERROR and does not throw when sale creation fails", async () => {
    const syncRepo = new FakeSyncRepository();
    const saleCreator = new FakeSaleCreator();
    saleCreator.shouldFail = true;
    const useCase = new PushSyncEventsUseCase(syncRepo, saleCreator, new FakeCashMovementCreator());

    const results = await withTenantContext(ALL_PERMISSIONS, () =>
      useCase.execute({
        deviceIdentifier: "device-1",
        platform: "ANDROID",
        branchId: "branch-1",
        userId: "user-1",
        events: [{ clientEventId: "evt-1", entityType: "SALE", payload: makeSalePayload() }],
      })
    );

    expect(results[0]).toMatchObject({ clientEventId: "evt-1", status: "ERROR", error: "stock insuficiente" });
    expect(syncRepo.outbox.get("evt-1")?.status).toBe("ERROR");
  });

  it("does not retry an event that already failed, even with the same payload", async () => {
    const syncRepo = new FakeSyncRepository();
    const saleCreator = new FakeSaleCreator();
    saleCreator.shouldFail = true;
    const useCase = new PushSyncEventsUseCase(syncRepo, saleCreator, new FakeCashMovementCreator());
    const event = { clientEventId: "evt-1", entityType: "SALE", payload: makeSalePayload() };

    await withTenantContext(ALL_PERMISSIONS, () =>
      useCase.execute({ deviceIdentifier: "device-1", platform: "ANDROID", branchId: "branch-1", userId: "user-1", events: [event] })
    );
    await withTenantContext(ALL_PERMISSIONS, () =>
      useCase.execute({ deviceIdentifier: "device-1", platform: "ANDROID", branchId: "branch-1", userId: "user-1", events: [event] })
    );

    expect(saleCreator.calls).toHaveLength(1);
  });

  it("rejects unsupported entity types without touching either creator", async () => {
    const syncRepo = new FakeSyncRepository();
    const saleCreator = new FakeSaleCreator();
    const cashMovementCreator = new FakeCashMovementCreator();
    const useCase = new PushSyncEventsUseCase(syncRepo, saleCreator, cashMovementCreator);

    const results = await withTenantContext(ALL_PERMISSIONS, () =>
      useCase.execute({
        deviceIdentifier: "device-1",
        platform: "ANDROID",
        branchId: "branch-1",
        userId: "user-1",
        events: [{ clientEventId: "evt-1", entityType: "STOCK_MOVEMENT", payload: {} }],
      })
    );

    expect(results[0].status).toBe("ERROR");
    expect(saleCreator.calls).toHaveLength(0);
    expect(cashMovementCreator.calls).toHaveLength(0);
  });

  it("registers a cash movement and marks the outbox event SYNCED", async () => {
    const syncRepo = new FakeSyncRepository();
    const cashMovementCreator = new FakeCashMovementCreator();
    const useCase = new PushSyncEventsUseCase(syncRepo, new FakeSaleCreator(), cashMovementCreator);

    const results = await withTenantContext(ALL_PERMISSIONS, () =>
      useCase.execute({
        deviceIdentifier: "device-1",
        platform: "ANDROID",
        branchId: "branch-1",
        userId: "user-1",
        events: [
          {
            clientEventId: "evt-1",
            entityType: "CASH_MOVEMENT",
            payload: { cashSessionId: "33333333-3333-3333-3333-333333333333", type: "INCOME", amount: 5000, concept: "Venta al menudeo" },
          },
        ],
      })
    );

    expect(results).toEqual([{ clientEventId: "evt-1", status: "SYNCED", entityId: "movement-1" }]);
    expect(cashMovementCreator.calls).toEqual([
      { cashSessionId: "33333333-3333-3333-3333-333333333333", input: { cashSessionId: "33333333-3333-3333-3333-333333333333", type: "INCOME", amount: 5000, concept: "Venta al menudeo" } },
    ]);
  });

  it("rejects a CASH_MOVEMENT event when the user lacks cash.movement.create, without touching the creator", async () => {
    const syncRepo = new FakeSyncRepository();
    const cashMovementCreator = new FakeCashMovementCreator();
    const useCase = new PushSyncEventsUseCase(syncRepo, new FakeSaleCreator(), cashMovementCreator);

    const results = await withTenantContext(new Set(["sale.create"]), () =>
      useCase.execute({
        deviceIdentifier: "device-1",
        platform: "ANDROID",
        branchId: "branch-1",
        userId: "user-1",
        events: [
          {
            clientEventId: "evt-1",
            entityType: "CASH_MOVEMENT",
            payload: { cashSessionId: "33333333-3333-3333-3333-333333333333", type: "INCOME", amount: 5000, concept: "Venta al menudeo" },
          },
        ],
      })
    );

    expect(results[0].status).toBe("ERROR");
    expect(results[0].error).toContain("cash.movement.create");
    expect(cashMovementCreator.calls).toHaveLength(0);
  });
});
