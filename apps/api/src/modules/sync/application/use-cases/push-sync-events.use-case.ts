import { createSaleSchema, type CreateSaleInput } from "@erp/shared-types";
import type { SaleRecord } from "../../../pos/sale/domain/sale.repository";
import type { ISyncRepository } from "../../domain/sync.repository";

/** Recorte de CreateSaleUseCase (mismo caso de uso que POST /sales) -- una interfaz en vez de la
 * clase concreta para poder sustituirla con un fake en tests, igual que el resto de los
 * repositorios del codebase. */
export interface ISaleCreator {
  execute(input: CreateSaleInput): Promise<SaleRecord>;
}

export interface PushSyncEventInput {
  clientEventId: string;
  entityType: string;
  payload?: unknown;
}

export interface PushSyncEventResult {
  clientEventId: string;
  status: "SYNCED" | "ERROR" | "CONFLICT";
  entityId?: string;
  error?: string;
}

export interface PushSyncEventsInput {
  deviceIdentifier: string;
  platform: string;
  branchId: string;
  userId: string;
  events: PushSyncEventInput[];
}

const SUPPORTED_ENTITY_TYPES = new Set(["SALE"]);

/**
 * JSON.stringify normal es sensible al orden de las claves -- Postgres JSONB NO preserva el
 * orden de insercion (las reordena), asi que comparar `existing.payload` (leido de vuelta desde
 * la DB) contra `event.payload` (el objeto recien parseado del request) con JSON.stringify plano
 * da falsos positivos de conflicto para el MISMO payload. Se ordenan las claves recursivamente
 * antes de comparar.
 */
function stableStringify(value: unknown): string {
  if (Array.isArray(value)) {
    return `[${value.map(stableStringify).join(",")}]`;
  }
  if (value !== null && typeof value === "object") {
    const keys = Object.keys(value as Record<string, unknown>).sort();
    return `{${keys.map((k) => `${JSON.stringify(k)}:${stableStringify((value as Record<string, unknown>)[k])}`).join(",")}}`;
  }
  return JSON.stringify(value);
}

/**
 * Aplica cada evento encolado offline reusando el MISMO caso de uso que el endpoint REST
 * equivalente (CreateSaleUseCase, ver POST /sales) -- ningun caso de uso nuevo, tal como preve
 * el diseño original del modulo (ver README). Idempotente por clientEventId: reenviar el mismo
 * push (ej. la respuesta anterior se perdio por la red) no vuelve a crear la venta.
 */
export class PushSyncEventsUseCase {
  constructor(
    private readonly syncRepo: ISyncRepository,
    private readonly createSaleUseCase: ISaleCreator
  ) {}

  async execute(input: PushSyncEventsInput): Promise<PushSyncEventResult[]> {
    await this.syncRepo.upsertDevice({
      deviceIdentifier: input.deviceIdentifier,
      platform: input.platform,
      branchId: input.branchId,
      userId: input.userId,
    });

    const results: PushSyncEventResult[] = [];

    for (const event of input.events) {
      const result = await this.processEvent(event, input.branchId, input.deviceIdentifier);
      results.push(result);
    }

    await this.syncRepo.touchDeviceLastSync(input.deviceIdentifier);
    return results;
  }

  private async processEvent(
    event: PushSyncEventInput,
    branchId: string,
    deviceIdentifier: string
  ): Promise<PushSyncEventResult> {
    if (!SUPPORTED_ENTITY_TYPES.has(event.entityType)) {
      return { clientEventId: event.clientEventId, status: "ERROR", error: `Tipo de entidad no soportado: ${event.entityType}` };
    }

    const existing = await this.syncRepo.findOutboxByClientEventId(event.clientEventId);

    if (existing) {
      // El chequeo de payload va SIEMPRE primero, incluso si ya esta SYNCED: un reenvio
      // idempotente (misma data) debe devolver el resultado guardado, pero el mismo
      // clientEventId con datos distintos es un conflicto real, no un simple retry, sin
      // importar en que estado haya quedado el evento original.
      const samePayload = stableStringify(existing.payload) === stableStringify(event.payload);
      if (!samePayload) {
        await this.syncRepo.createConflictLog(existing.id, "El mismo clientEventId se reenvio con datos distintos");
        return { clientEventId: event.clientEventId, status: "CONFLICT", error: "El evento ya existe con datos distintos" };
      }
      if (existing.status === "SYNCED") {
        return { clientEventId: event.clientEventId, status: "SYNCED", entityId: existing.entityId ?? undefined };
      }
      if (existing.status === "ERROR") {
        // No se reintenta automaticamente: si la venta original ya alcanzo a crearse antes de
        // que fallara un paso posterior (ver limitacion conocida de CreateSaleUseCase, la
        // contabilizacion no esta en la misma transaccion), reintentar podria duplicarla.
        // Queda para revision manual.
        return { clientEventId: event.clientEventId, status: "ERROR", error: existing.errorMessage ?? "Fallo previamente, revisar manualmente" };
      }
      // status === "PENDING": el proceso se interrumpio a mitad de camino (ej. crash del
      // servidor) sin haber creado la venta todavia -- seguro reintentar.
      return this.replay(existing.id, event);
    }

    const outboxEntry = await this.syncRepo.createOutboxPending({
      clientEventId: event.clientEventId,
      branchId,
      entityType: "Sale",
      operation: "CREATE",
      payload: event.payload,
      originDeviceId: deviceIdentifier,
    });
    return this.replay(outboxEntry.id, event);
  }

  private async replay(outboxId: string, event: PushSyncEventInput): Promise<PushSyncEventResult> {
    try {
      const parsed = createSaleSchema.parse(event.payload);
      const sale = await this.createSaleUseCase.execute(parsed);
      await this.syncRepo.markOutboxSynced(outboxId, sale.id);
      return { clientEventId: event.clientEventId, status: "SYNCED", entityId: sale.id };
    } catch (err) {
      const message = err instanceof Error ? err.message : "Error desconocido";
      await this.syncRepo.markOutboxError(outboxId, message);
      return { clientEventId: event.clientEventId, status: "ERROR", error: message };
    }
  }
}
