import type { AuditService } from "../../../../audit/application/audit.service";
import type { GenerateElectronicCreditNoteUseCase } from "../../../../electronic-invoicing/application/use-cases/generate-electronic-credit-note.use-case";
import type { CreateCreditNoteData, CreditNoteRecord, ICreditNoteRepository } from "../../domain/credit-note.repository";

export class CreateCreditNoteUseCase {
  constructor(
    private readonly repo: ICreditNoteRepository,
    private readonly generateElectronicCreditNote: GenerateElectronicCreditNoteUseCase,
    private readonly audit: AuditService
  ) {}

  async execute(data: CreateCreditNoteData): Promise<CreditNoteRecord> {
    const note = await this.repo.create(data);
    await this.audit.record({
      action: "CREDIT_NOTE_ISSUED",
      entityType: "CreditNote",
      entityId: note.id,
      description: `Nota credito emitida por ${note.amount}: ${note.reason}`,
    });

    try {
      await this.generateElectronicCreditNote.execute({
        creditNoteId: note.id,
        branchId: data.branchId,
        customerId: data.customerId ?? null,
        saleId: data.saleId ?? null,
        issueDate: note.createdAt,
        amount: note.amount,
        reason: note.reason,
      });
    } catch (err) {
      // No bloquea: la nota queda emitida sin CUDE (ej. sin venta referenciada, o esa venta
      // aun no tiene factura electronica), recuperable via el endpoint de reenvio manual una
      // vez se resuelva -- mismo criterio que create-sale.use-case.ts usa para facturas.
      await this.audit.record({
        action: "ELECTRONIC_CREDIT_NOTE_GENERATION_FAILED",
        entityType: "CreditNote",
        entityId: note.id,
        description: `No se pudo generar la nota credito electronica: ${(err as Error).message}`,
        metadata: {},
      });
    }

    return note;
  }
}
