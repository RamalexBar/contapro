import { round2 } from "@erp/shared-utils";
import { ValidationError } from "../../../../../shared/errors/app-error";
import type { AuditService } from "../../../../audit/application/audit.service";
import type { CreditNoteConceptCode } from "../../../../electronic-invoicing/application/constants";
import { noteLinesFromAmount } from "../../../../electronic-invoicing/application/note-lines";
import type { GenerateElectronicCreditNoteUseCase } from "../../../../electronic-invoicing/application/use-cases/generate-electronic-credit-note.use-case";
import type { ThirdPartyDocumentLineInput } from "../../../../electronic-invoicing/domain/third-party-invoicing-client";
import type { ISaleRepository } from "../../../sale/domain/sale.repository";
import type { CreditNoteRecord, ICreditNoteRepository } from "../../domain/credit-note.repository";

/** Ventas sobre las que tiene sentido una nota credito (ya facturadas, no anuladas). */
const CREDITABLE_SALE_STATUSES = new Set(["COMPLETED", "RETURNED_PARTIAL", "RETURNED_FULL"]);

/** Nota libre: rebaja/descuento, ajuste de precio, pronto pago o volumen. Las devoluciones (1) y la
 * anulacion (2) salen de Devoluciones, porque ademas mueven inventario y caja. */
export type FreeCreditNoteConcept = Extract<CreditNoteConceptCode, "3" | "4" | "5" | "6">;

export interface CreateCreditNoteInput {
  saleId: string;
  conceptCode: FreeCreditNoteConcept;
  reason: string;
  /** Valor total de la nota, con IVA. */
  amount: number;
}

export interface CreditNoteForReturnInput {
  returnId: string;
  saleId: string;
  branchId: string;
  customerId: string | null;
  /** 1 devolucion parcial; 2 si con esta devolucion la venta quedo devuelta completa. */
  conceptCode: Extract<CreditNoteConceptCode, "1" | "2">;
  reason: string;
  amount: number;
  lines: ThirdPartyDocumentLineInput[];
  paymentMethodCode?: string;
}

export class CreateCreditNoteUseCase {
  constructor(
    private readonly repo: ICreditNoteRepository,
    private readonly saleRepo: ISaleRepository,
    private readonly generateElectronicCreditNote: GenerateElectronicCreditNoteUseCase,
    private readonly audit: AuditService
  ) {}

  /** Nota credito libre sobre una venta: el valor se reparte entre las tarifas de IVA de la venta. */
  async execute(input: CreateCreditNoteInput): Promise<CreditNoteRecord> {
    const sale = await this.saleRepo.findByIdOrThrow(input.saleId);
    if (!CREDITABLE_SALE_STATUSES.has(sale.status)) {
      throw new ValidationError(`No se puede emitir una nota credito sobre una venta en estado ${sale.status}`);
    }
    const alreadyCredited = await this.repo.totalCreditedForSale(sale.id);
    const available = round2(sale.total - alreadyCredited);
    if (input.amount > available + 0.009) {
      throw new ValidationError(`La venta #${sale.number} solo admite notas credito por ${available} (total ${sale.total}, ya acreditado ${alreadyCredited})`);
    }

    const lines = noteLinesFromAmount({
      amount: input.amount,
      description: input.reason,
      saleLines: sale.items.map((i) => ({ taxPercent: i.taxPercent, total: i.total })),
      taxable: true,
    });
    return this.issue({
      saleId: sale.id,
      branchId: sale.branchId,
      customerId: sale.customerId,
      returnId: null,
      conceptCode: input.conceptCode,
      reason: input.reason,
      amount: round2(input.amount),
      lines,
    });
  }

  /** Nota credito de una devolucion, con los productos devueltos como renglones. */
  async executeForReturn(input: CreditNoteForReturnInput): Promise<CreditNoteRecord> {
    return this.issue(input);
  }

  private async issue(input: {
    saleId: string;
    branchId: string;
    customerId: string | null;
    returnId: string | null;
    conceptCode: CreditNoteConceptCode;
    reason: string;
    amount: number;
    lines: ThirdPartyDocumentLineInput[];
    paymentMethodCode?: string;
  }): Promise<CreditNoteRecord> {
    const note = await this.repo.create({
      branchId: input.branchId,
      customerId: input.customerId,
      saleId: input.saleId,
      returnId: input.returnId,
      conceptCode: input.conceptCode,
      reason: input.reason,
      amount: input.amount,
    });
    await this.audit.record({
      action: "CREDIT_NOTE_ISSUED",
      entityType: "CreditNote",
      entityId: note.id,
      description: `Nota credito emitida por ${note.amount}: ${note.reason}`,
    });

    try {
      const electronic = await this.generateElectronicCreditNote.execute({
        creditNoteId: note.id,
        branchId: input.branchId,
        customerId: input.customerId,
        saleId: input.saleId,
        issueDate: note.createdAt,
        amount: note.amount,
        reason: note.reason,
        conceptCode: input.conceptCode,
        lines: input.lines,
        paymentMethodCode: input.paymentMethodCode,
      });
      return { ...note, electronic: { fullNumber: electronic.fullNumber, status: electronic.status, rejectionReason: null } };
    } catch (err) {
      // No bloquea: la nota queda emitida sin documento electronico (ej. la venta no tiene factura
      // autorizada), recuperable con el reenvio manual una vez se resuelva.
      await this.audit.record({
        action: "ELECTRONIC_CREDIT_NOTE_GENERATION_FAILED",
        entityType: "CreditNote",
        entityId: note.id,
        description: `No se pudo generar la nota credito electronica: ${(err as Error).message}`,
        metadata: {},
      });
      return note;
    }
  }
}
