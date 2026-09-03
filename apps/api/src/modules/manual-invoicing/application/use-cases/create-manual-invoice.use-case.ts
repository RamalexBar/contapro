import { calculateTax, round2 } from "@erp/shared-utils";
import { getTenantContext } from "../../../../shared/context/request-context";
import { ValidationError } from "../../../../shared/errors/app-error";
import type { AuditService } from "../../../audit/application/audit.service";
import type { ICompanyProfileRepository } from "../../../company/domain/company-profile.repository";
import { isCompanyProfileComplete } from "../../../company/application/is-company-profile-complete";
import type { GenerateElectronicInvoiceUseCase } from "../../../electronic-invoicing/application/use-cases/generate-electronic-invoice.use-case";
import type { IManualInvoiceRepository, ManualInvoiceRecord } from "../../domain/manual-invoice.repository";

export interface CreateManualInvoiceItemInput {
  description: string;
  quantity: number;
  unitPrice: number;
  taxPercent: number;
}

export interface CreateManualInvoiceInput {
  branchId: string;
  customerId?: string | null;
  items: CreateManualInvoiceItemInput[];
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
    private readonly audit: AuditService
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
      items,
    });

    await this.audit.record({
      action: "MANUAL_INVOICE_CREATED",
      entityType: "ManualInvoice",
      entityId: invoice.id,
      description: `Factura manual creada por ${total}`,
      metadata: { total },
    });

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
}
