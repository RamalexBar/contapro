import { PrismaAuditLogRepository } from "../audit/infrastructure/prisma-audit-log.repository";
import { AuditService } from "../audit/application/audit.service";
import { postDepreciationJournalEntryUseCase } from "../accounting/accounting.container";
import { PrismaFixedAssetRepository } from "./infrastructure/prisma-fixed-asset.repository";
import { PrismaDepreciationEntryRepository } from "./infrastructure/prisma-depreciation-entry.repository";
import { CreateFixedAssetUseCase } from "./application/use-cases/create-fixed-asset.use-case";
import { UpdateFixedAssetUseCase } from "./application/use-cases/update-fixed-asset.use-case";
import { DeactivateFixedAssetUseCase } from "./application/use-cases/deactivate-fixed-asset.use-case";
import { ListFixedAssetsUseCase } from "./application/use-cases/list-fixed-assets.use-case";
import { CalculateDepreciationUseCase } from "./application/use-cases/calculate-depreciation.use-case";
import { ListDepreciationEntriesUseCase } from "./application/use-cases/list-depreciation-entries.use-case";
import { PostDepreciationEntryUseCase } from "./application/use-cases/post-depreciation-entry.use-case";
import { FixedAssetsController } from "./interfaces/fixed-assets.controller";

const fixedAssetRepo = new PrismaFixedAssetRepository();
const entryRepo = new PrismaDepreciationEntryRepository();
const auditService = new AuditService(new PrismaAuditLogRepository());

export const fixedAssetsController = new FixedAssetsController(
  new CreateFixedAssetUseCase(fixedAssetRepo, auditService),
  new UpdateFixedAssetUseCase(fixedAssetRepo, auditService),
  new DeactivateFixedAssetUseCase(fixedAssetRepo, auditService),
  new ListFixedAssetsUseCase(fixedAssetRepo),
  new CalculateDepreciationUseCase(fixedAssetRepo, entryRepo, auditService),
  new ListDepreciationEntriesUseCase(entryRepo),
  new PostDepreciationEntryUseCase(entryRepo, fixedAssetRepo, postDepreciationJournalEntryUseCase, auditService)
);
