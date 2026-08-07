import { createSaleUseCase } from "../pos/sale/sale.container";
import { registerCashMovementUseCase } from "../cash/cash-session/cash-session.container";
import { PrismaSyncRepository } from "./infrastructure/prisma-sync.repository";
import { PushSyncEventsUseCase } from "./application/use-cases/push-sync-events.use-case";
import { PullSyncChangesUseCase } from "./application/use-cases/pull-sync-changes.use-case";
import { SyncController } from "./interfaces/sync.controller";

const syncRepo = new PrismaSyncRepository();

export const syncController = new SyncController(
  new PushSyncEventsUseCase(syncRepo, createSaleUseCase, registerCashMovementUseCase),
  new PullSyncChangesUseCase(syncRepo)
);
