import type { AuditService } from "../../../../audit/application/audit.service";
import type { GenerateElectronicDebitNoteUseCase } from "../../../../electronic-invoicing/application/use-cases/generate-electronic-debit-note.use-case";
import type { CreateDebitNoteData, DebitNoteRecord, IDebitNoteRepository } from "../../domain/debit-note.repository";

export class CreateDebitNoteUseCase {
  constructor(
    private readonly repo: IDebitNoteRepository,
    private readonly generateElectronicDebitNote: GenerateElectronicDebitNoteUseCase,
    private readonly audit: AuditService
  ) {}

  async execute(data: CreateDebitNoteData): Promise<DebitNoteRecord> {
    const note = await this.repo.create(data);
    await this.audit.record({
      action: "DEBIT_NOTE_ISSUED",
      entityType: "DebitNote",
      entityId: note.id,
      description: `Nota debito emitida por ${note.amount}: ${note.reason}`,
    });

    try {
      await this.generateElectronicDebitNote.execute({
        debitNoteId: note.id,
        branchId: data.branchId,
        customerId: data.customerId ?? null,
        saleId: data.saleId ?? null,
        issueDate: note.createdAt,
        amount: note.amount,
        reason: note.reason,
      });
    } catch (err) {
      await this.audit.record({
        action: "ELECTRONIC_DEBIT_NOTE_GENERATION_FAILED",
        entityType: "DebitNote",
        entityId: note.id,
        description: `No se pudo generar la nota debito electronica: ${(err as Error).message}`,
        metadata: {},
      });
    }

    return note;
  }
}
