import { ValidationError } from "../../../../shared/errors/app-error";
import type { AuditService } from "../../../audit/application/audit.service";
import type { IJournalEntryRepository, JournalEntryRecord } from "../../domain/journal-entry.repository";

export class PostJournalEntryUseCase {
  constructor(private readonly repo: IJournalEntryRepository, private readonly audit: AuditService) {}

  async execute(id: string): Promise<JournalEntryRecord> {
    const entry = await this.repo.findByIdOrThrow(id);
    if (entry.status !== "DRAFT") {
      throw new ValidationError(`Solo se puede contabilizar un comprobante en estado DRAFT (actual: ${entry.status})`);
    }

    const updated = await this.repo.updateStatus(id, "POSTED", new Date());

    await this.audit.record({
      action: "JOURNAL_ENTRY_POSTED",
      entityType: "JournalEntry",
      entityId: id,
      description: `Comprobante #${entry.number} contabilizado`,
    });

    return updated;
  }
}
