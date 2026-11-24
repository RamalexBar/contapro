import { round2 } from "@erp/shared-utils";
import { ValidationError } from "../../../../../shared/errors/app-error";
import type { AuditService } from "../../../../audit/application/audit.service";
import type { DebitNoteConceptCode } from "../../../../electronic-invoicing/application/constants";
import { noteLinesFromAmount } from "../../../../electronic-invoicing/application/note-lines";
import type { GenerateElectronicDebitNoteUseCase } from "../../../../electronic-invoicing/application/use-cases/generate-electronic-debit-note.use-case";
import type { ISaleRepository } from "../../../sale/domain/sale.repository";
import type { DebitNoteRecord, IDebitNoteRepository } from "../../domain/debit-note.repository";
import type { PostNoteJournalEntryUseCase } from "../../../../accounting/application/use-cases/post-note-journal-entry.use-case";
import type { ThirdPartyDocumentLineInput } from "../../../../electronic-invoicing/domain/third-party-invoicing-client";
/** Base sin IVA de los renglones de una nota y su IVA (el resto hasta el valor total). */
function splitNoteAmount(lines: ThirdPartyDocumentLineInput[], amount: number): { base: number; tax: number } {
  const base = round2(lines.reduce((s, l) => s + l.quantity * l.unitPrice * (1 - (l.discountPercent ?? 0) / 100), 0));
  return { base, tax: round2(amount - base) };
}


const DEBITABLE_SALE_STATUSES = new Set(["COMPLETED", "RETURNED_PARTIAL", "RETURNED_FULL"]);

export interface CreateDebitNoteInput {
  saleId: string;
  conceptCode: DebitNoteConceptCode;
  reason: string;
  /** Valor total de la nota, con IVA si aplica. */
  amount: number;
}

/**
 * Nota debito sobre una venta facturada (cobro adicional). Solo "3 Cambio del valor" lleva IVA,
 * repartido como la venta original: los intereses de mora y los gastos de cobranza no son una
 * venta gravada (no causan IVA), asi que van como un renglon excluido.
 */
export class CreateDebitNoteUseCase {
  constructor(
    private readonly repo: IDebitNoteRepository,
    private readonly saleRepo: ISaleRepository,
    private readonly generateElectronicDebitNote: GenerateElectronicDebitNoteUseCase,
    private readonly audit: AuditService,
    private readonly postNoteJournal: PostNoteJournalEntryUseCase
  ) {}

  async execute(input: CreateDebitNoteInput): Promise<DebitNoteRecord> {
    const sale = await this.saleRepo.findByIdOrThrow(input.saleId);
    if (!DEBITABLE_SALE_STATUSES.has(sale.status)) {
      throw new ValidationError(`No se puede emitir una nota debito sobre una venta en estado ${sale.status}`);
    }
    const amount = round2(input.amount);

    const note = await this.repo.create({
      branchId: sale.branchId,
      customerId: sale.customerId,
      saleId: sale.id,
      conceptCode: input.conceptCode,
      reason: input.reason,
      amount,
    });
    await this.audit.record({
      action: "DEBIT_NOTE_ISSUED",
      entityType: "DebitNote",
      entityId: note.id,
      description: `Nota debito emitida por ${note.amount}: ${note.reason}`,
    });

    const lines = noteLinesFromAmount({
      amount,
      description: input.reason,
      saleLines: sale.items.map((i) => ({ taxPercent: i.taxPercent, total: i.total })),
      taxable: input.conceptCode === "3",
    });

    // Comprobante: con cliente queda cargado a su cuenta (1305); sin cliente, cobrado de contado.
    try {
      const { base, tax } = splitNoteAmount(lines, amount);
      await this.postNoteJournal.execute({
        kind: "DEBIT",
        noteId: note.id,
        branchId: sale.branchId,
        date: note.createdAt,
        base,
        tax,
        conceptCode: input.conceptCode,
        settlement: sale.customerId ? "CREDIT_TO_ACCOUNT" : "CASH",
        description: `Nota debito venta #${sale.number}: ${input.reason}`,
      });
    } catch (err) {
      await this.audit.record({
        action: "NOTE_ACCOUNTING_FAILED",
        entityType: "DebitNote",
        entityId: note.id,
        description: `No se pudo contabilizar la nota debito: ${(err as Error).message}`,
      });
    }

    try {
      const electronic = await this.generateElectronicDebitNote.execute({
        debitNoteId: note.id,
        branchId: sale.branchId,
        customerId: sale.customerId,
        saleId: sale.id,
        issueDate: note.createdAt,
        amount,
        reason: input.reason,
        conceptCode: input.conceptCode,
        lines,
      });
      return { ...note, electronic: { fullNumber: electronic.fullNumber, status: electronic.status, rejectionReason: null } };
    } catch (err) {
      await this.audit.record({
        action: "ELECTRONIC_DEBIT_NOTE_GENERATION_FAILED",
        entityType: "DebitNote",
        entityId: note.id,
        description: `No se pudo generar la nota debito electronica: ${(err as Error).message}`,
        metadata: {},
      });
      return note;
    }
  }
}
