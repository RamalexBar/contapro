import { PrismaAuditLogRepository } from "../../audit/infrastructure/prisma-audit-log.repository";
import { AuditService } from "../../audit/application/audit.service";
import { PrismaStockMovementRepository } from "./infrastructure/prisma-stock-movement.repository";
import { PrismaKardexRepository } from "./infrastructure/prisma-kardex.repository";
import { RegisterStockEntryUseCase } from "./application/use-cases/register-stock-entry.use-case";
import { AdjustStockUseCase } from "./application/use-cases/adjust-stock.use-case";
import { TransferStockUseCase } from "./application/use-cases/transfer-stock.use-case";
import { ListKardexUseCase } from "./application/use-cases/list-kardex.use-case";
import { ListBranchStockUseCase } from "./application/use-cases/list-branch-stock.use-case";
import { StockController } from "./interfaces/stock.controller";

const repo = new PrismaStockMovementRepository();
const kardexRepo = new PrismaKardexRepository();
const auditService = new AuditService(new PrismaAuditLogRepository());

/** Usado por suppliers.container.ts para el impacto en inventario de una recepcion de
 * mercancia (ReceiveGoodsUseCase). */
export const stockRepo = repo;

export const stockController = new StockController(
  new RegisterStockEntryUseCase(repo, auditService),
  new AdjustStockUseCase(repo, auditService),
  new TransferStockUseCase(repo, auditService),
  new ListKardexUseCase(kardexRepo),
  new ListBranchStockUseCase(repo)
);
