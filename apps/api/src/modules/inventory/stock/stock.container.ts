import { PrismaAuditLogRepository } from "../../audit/infrastructure/prisma-audit-log.repository";
import { AuditService } from "../../audit/application/audit.service";
import { PrismaStockMovementRepository } from "./infrastructure/prisma-stock-movement.repository";
import { RegisterStockEntryUseCase } from "./application/use-cases/register-stock-entry.use-case";
import { AdjustStockUseCase } from "./application/use-cases/adjust-stock.use-case";
import { TransferStockUseCase } from "./application/use-cases/transfer-stock.use-case";
import { StockController } from "./interfaces/stock.controller";

const repo = new PrismaStockMovementRepository();
const auditService = new AuditService(new PrismaAuditLogRepository());

export const stockController = new StockController(
  new RegisterStockEntryUseCase(repo, auditService),
  new AdjustStockUseCase(repo, auditService),
  new TransferStockUseCase(repo, auditService)
);
