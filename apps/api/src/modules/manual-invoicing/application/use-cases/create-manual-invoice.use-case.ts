import { calculateTax, round2 } from "@erp/shared-utils";
import { getTenantContext } from "../../../../shared/context/request-context";
import { ValidationError } from "../../../../shared/errors/app-error";
import type { AuditService } from "../../../audit/application/audit.service";
import type { ICompanyProfileRepository } from "../../../company/domain/company-profile.repository";
import { isCompanyProfileComplete } from "../../../company/application/is-company-profile-complete";
import type { GenerateElectronicInvoiceUseCase } from "../../../electronic-invoicing/application/use-cases/generate-electronic-invoice.use-case";
import type { IManualInvoiceRepository, ManualInvoiceRecord } from "../../domain/manual-invoice.repository";
import type { PostManualInvoiceJournalEntryUseCase } from "../../../accounting/application/use-cases/post-manual-invoice-journal-entry.use-case";
import type { IAccountReceivableRepository } from "../../../collections/domain/account-receivable.repository";

/** Plazo por defecto de la cuenta por cobrar de una factura manual con cliente. */
const DEFAULT_CREDIT_DAYS = 30;

export interface CreateManualInvoiceItemInput {
  description: string;
  quantity: number;
  unitPrice: number;
  taxPercent: number;
  /** IVA (por defecto) | INC | EXEMPT | EXCLUDED */
  taxType?: "IVA" | "INC" | "EXEMPT" | "EXCLUDED";
}

export interface CreateManualInvoiceInput {
  branchId: string;
  customerId?: string | null;
  items: CreateManualInvoiceItemInput[];
  /** Vencimiento de la cuenta por cobrar (por defecto 30 dias). */
  dueDate?: Date | null;
  /**
   * false = no contabiliza ni crea cuenta por cobrar. Lo usa la API publica: las facturas de un POS
   * externo ya se contabilizan con su cierre de turno, y hacerlo aqui duplicaria el ingreso.
   */
  postAccounting?: boolean;
}

/**
 * Factura sin POS/producto (ver README del modulo) -- plantilla directa del bloque de computo de
 * items de CreateSaleUseCase, pero sin descuentos ni retenciones (fuera de alcance de esta
 * iteracion, ver README). Antes de crear nada, exige que el perfil fiscal de la empresa
 * (modules/company) este completo -- decision del usuario: sin esos datos, no se puede facturar
 * "solo con esto" como pide una empresa que no usa POS. Igual que CreateSaleUseCase, la
 * generacion de la factura electronica es no bloqueante: si falla, la factura manual queda creada
 * igual y el fallo se audita (mismo criterio "sin crash silencioso" del resto del repo).
 */
export class CreateManualInvoiceUseCase {
  constructor(
    private readonly manualInvoiceRepo: IManualInvoiceRepository,
    private readonly companyProfileRepo: ICompanyProfileRepository,
    private readonly generateElectronicInvoice: GenerateElectronicInvoiceUseCase,
    private readonly audit: AuditService,
    private readonly postJournalEntry: PostManualInvoiceJournalEntryUseCase,
    private readonly accountReceivableRepo: IAccountReceivableRepository
  ) {}

  async execute(input: CreateManualInvoiceInput): Promise<ManualInvoiceRecord> {
    const ctx = getTenantContext();

    const company = await this.companyProfileRepo.findByIdOrThrow(ctx.companyId);
    const { complete, missingFields } = isCompanyProfileComplete(company);
    if (!complete) {
      throw new ValidationError(
        `Completa los datos fiscales de la empresa antes de crear una factura manual (faltan: ${missingFields.join(", ")})`
      );
    }

    if (input.items.length === 0) {
      throw new ValidationError("La factura debe tener al menos una linea");
    }

    let subtotal = 0;
    let taxTotal = 0;
    let total = 0;
    const items = input.items.map((item) => {
      const lineSubtotal = round2(item.unitPrice * item.quantity);
      const taxAmount = calculateTax(lineSubtotal, item.taxPercent);
      const lineTotal = round2(lineSubtotal + taxAmount);
      subtotal = round2(subtotal + lineSubtotal);
      taxTotal = round2(taxTotal + taxAmount);
      total = round2(total + lineTotal);
      return {
        description: item.description,
        quantity: item.quantity,
        unitPrice: item.unitPrice,
        taxPercent: item.taxPercent,
        taxType: item.taxType ?? "IVA",
        taxAmount,
        total: lineTotal,
      };
    });

    const issueDate = new Date();
    const invoice = await this.manualInvoiceRepo.create({
      branchId: input.branchId,
      customerId: input.customerId ?? null,
      createdByUserId: ctx.userId,
      issueDate,
      subtotal,
      taxTotal,
      total,
      dueDate: input.customerId ? (input.dueDate ?? new Date(issueDate.getTime() + DEFAULT_CREDIT_DAYS * 86_400_000)) : null,
      items,
    });

    await this.audit.record({
      action: "MANUAL_INVOICE_CREATED",
      entityType: "ManualInvoice",
      entityId: invoice.id,
      description: `Factura manual creada por ${total}`,
      metadata: { total },
    });

    if (input.postAccounting !== false) await this.postAccountingAndReceivable(invoice, items);

    try {
      await this.generateElectronicInvoice.execute({
        source: { type: "manual", manualInvoiceId: invoice.id },
        branchId: invoice.branchId,
        customerId: invoice.customerId,
        issueDate,
        subtotal,
        taxTotal,
        total,
        items: items.map((item) => ({
          description: item.description,
          quantity: item.quantity,
          unitPrice: item.unitPrice,
          taxPercent: item.taxPercent,
          taxType: item.taxType,
          taxAmount: item.taxAmount,
          total: item.total,
        })),
        withholdingTaxes: [],
      });
    } catch (err) {
      // No bloquea (mismo criterio que CreateSaleUseCase): la factura manual queda creada sin
      // CUFE, recuperable via reenvio manual despues.
      await this.audit.record({
        action: "ELECTRONIC_INVOICE_GENERATION_FAILED",
        entityType: "ManualInvoice",
        entityId: invoice.id,
        description: `No se pudo generar la factura electronica de la factura manual ${invoice.id}: ${(err as Error).message}`,
        metadata: {},
      });
    }

    return invoice;
  }

  /**
   * Comprobante (ingreso, IVA, impuesto al consumo) y, si tiene cliente, la cuenta por cobrar que se
   * abona en Cobranza. Sin cliente se asume de contado. No bloquea: si falla (ej. el mes esta
   * cerrado), la factura queda creada y el motivo en Auditoria.
   */
  private async postAccountingAndReceivable(invoice: ManualInvoiceRecord, items: Array<{ taxType: string; taxAmount: number }>): Promise<void> {
    try {
      const incTotal = round2(items.filter((i) => i.taxType === "INC").reduce((s, i) => s + i.taxAmount, 0));
      const entry = await this.postJournalEntry.execute({
        manualInvoiceId: invoice.id,
        branchId: invoice.branchId,
        date: invoice.issueDate,
        subtotal: invoice.subtotal,
        ivaTotal: round2(invoice.taxTotal - incTotal),
        incTotal,
        onCredit: Boolean(invoice.customerId),
        description: `Factura manual ${invoice.id.slice(0, 8)}`,
      });
      if (entry) {
        await this.manualInvoiceRepo.setJournalEntryId(invoice.id, entry.id);
        invoice.journalEntryId = entry.id;
      }
      if (invoice.customerId && invoice.dueDate) {
        await this.accountReceivableRepo.create({ customerId: invoice.customerId, manualInvoiceId: invoice.id, amount: invoice.total, dueDate: invoice.dueDate });
      }
      await this.audit.record({
        action: "MANUAL_INVOICE_POSTED",
        entityType: "ManualInvoice",
        entityId: invoice.id,
        description: `Factura manual contabilizada${entry ? ` (comprobante #${entry.number})` : ""}${invoice.customerId ? ", con cuenta por cobrar" : ", de contado"}`,
      });
    } catch (err) {
      await this.audit.record({
        action: "MANUAL_INVOICE_ACCOUNTING_FAILED",
        entityType: "ManualInvoice",
        entityId: invoice.id,
        description: `No se pudo contabilizar la factura manual: ${(err as Error).message}`,
      });
    }
  }
}
