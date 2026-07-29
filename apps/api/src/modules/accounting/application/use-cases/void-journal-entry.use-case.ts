import { ValidationError } from "../../../../shared/errors/app-error";
import type { AuditService } from "../../../audit/application/audit.service";
import type { IJournalEntryRepository, JournalEntryRecord } from "../../domain/journal-entry.repository";

export class VoidJournalEntryUseCase {
  constructor(private readonly repo: IJournalEntryRepository, private readonly audit: AuditService) {}

  async execute(id: string): Promise<JournalEntryRecord> {
    const entry = await this.repo.findByIdOrThrow(id);
    if (entry.status === "VOID") {
      throw new ValidationError("Este comprobante ya esta anulado");
    }

    const updated = await this.repo.updateStatus(id, "VOID");

    await this.audit.record({
      action: "JOURNAL_ENTRY_VOIDED",
      entityType: "JournalEntry",
      entityId: id,
      description: `Comprobante #${entry.number} anulado`,
    });

    return updated;
  }
}
