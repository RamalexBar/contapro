import type { AuditService } from "../../../../audit/application/audit.service";
import type { CreateCreditNoteData, CreditNoteRecord, ICreditNoteRepository } from "../../domain/credit-note.repository";

export class CreateCreditNoteUseCase {
  constructor(private readonly repo: ICreditNoteRepository, private readonly audit: AuditService) {}

  async execute(data: CreateCreditNoteData): Promise<CreditNoteRecord> {
    const note = await this.repo.create(data);
    await this.audit.record({
      action: "CREDIT_NOTE_ISSUED",
      entityType: "CreditNote",
      entityId: note.id,
      description: `Nota credito emitida por ${note.amount}: ${note.reason}`,
    });
    return note;
  }
}
