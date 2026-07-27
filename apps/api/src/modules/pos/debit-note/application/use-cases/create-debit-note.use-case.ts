import type { AuditService } from "../../../../audit/application/audit.service";
import type { CreateDebitNoteData, DebitNoteRecord, IDebitNoteRepository } from "../../domain/debit-note.repository";

export class CreateDebitNoteUseCase {
  constructor(private readonly repo: IDebitNoteRepository, private readonly audit: AuditService) {}

  async execute(data: CreateDebitNoteData): Promise<DebitNoteRecord> {
    const note = await this.repo.create(data);
    await this.audit.record({
      action: "DEBIT_NOTE_ISSUED",
      entityType: "DebitNote",
      entityId: note.id,
      description: `Nota debito emitida por ${note.amount}: ${note.reason}`,
    });
    return note;
  }
}
