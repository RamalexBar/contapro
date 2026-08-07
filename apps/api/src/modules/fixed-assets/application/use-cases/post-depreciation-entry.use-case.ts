import { ValidationError } from "../../../../shared/errors/app-error";
import type { AuditService } from "../../../audit/application/audit.service";
import type { IFixedAssetRepository } from "../../domain/fixed-asset.repository";
import type { DepreciationEntryRecord, IDepreciationEntryRepository } from "../../domain/depreciation-entry.repository";
import type { PostDepreciationJournalEntryUseCase } from "../../../accounting/application/use-cases/post-depreciation-journal-entry.use-case";

export class PostDepreciationEntryUseCase {
  constructor(
    private readonly entryRepo: IDepreciationEntryRepository,
    private readonly fixedAssetRepo: IFixedAssetRepository,
    private readonly postDepreciationJournalEntry: PostDepreciationJournalEntryUseCase,
    private readonly audit: AuditService
  ) {}

  async execute(id: string): Promise<DepreciationEntryRecord> {
    const entry = await this.entryRepo.findByIdOrThrow(id);
    if (entry.status !== "CALCULATED") {
      throw new ValidationError(`La entrada ya esta en estado ${entry.status}, no se puede contabilizar de nuevo`);
    }

    const asset = await this.fixedAssetRepo.findByIdOrThrow(entry.fixedAssetId);

    const journalEntry = await this.postDepreciationJournalEntry.execute({
      depreciationEntryId: entry.id,
      branchId: asset.branchId,
      date: new Date(),
      assetName: asset.name,
      amount: entry.amount,
    });

    const posted = await this.entryRepo.markPosted(entry.id, {
      journalEntryId: journalEntry?.id ?? null,
      postedAt: new Date(),
    });
    await this.fixedAssetRepo.incrementAccumulatedDepreciation(asset.id, entry.amount);

    await this.audit.record({
      action: "DEPRECIATION_POSTED",
      entityType: "DepreciationEntry",
      entityId: posted.id,
      description: `Depreciacion contabilizada para el activo ${asset.name}: ${entry.amount}`,
    });

    return posted;
  }
}
