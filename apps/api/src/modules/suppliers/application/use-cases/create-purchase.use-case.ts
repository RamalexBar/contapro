import { calculateTax, round2 } from "@erp/shared-utils";
import { ValidationError } from "../../../../shared/errors/app-error";
import type { AuditService } from "../../../audit/application/audit.service";
import type { PostPurchaseJournalEntryUseCase } from "../../../accounting/application/use-cases/post-purchase-journal-entry.use-case";
import type { GenerateElectronicSupportDocumentUseCase } from "../../../electronic-invoicing/application/use-cases/generate-electronic-support-document.use-case";
import type { IWithholdingConceptRepository } from "../../../accounting/domain/withholding-concept.repository";
import { sumWithholdingsByType } from "../../../accounting/application/sum-withholdings-by-type";
import type { ISupplierRepository } from "../../domain/supplier.repository";
import type { ComputedPurchaseWithholding, CreatePurchaseData, IPurchaseRepository, PurchaseRecord } from "../../domain/purchase.repository";

/** Entrada de retencion pedida por quien registra la compra, antes de resolver el concepto. */
export interface PurchaseWithholdingInput {
  withholdingConceptId: string;
  base: number;
}

export type CreatePurchaseInput = Omit<CreatePurchaseData, "retentionTotal" | "withholdings"> & {
  withholdings: PurchaseWithholdingInput[];
};

/**
 * Registro minimo de una factura de compra (sin flujo de orden de compra/recepcion de
 * mercancia todavia, ver README.md): crea el Purchase + su AccountPayable y contabiliza de
 * una vez el comprobante (Inventario + IVA descontable vs Proveedores).
 */
export class CreatePurchaseUseCase {
  constructor(
    private readonly purchaseRepo: IPurchaseRepository,
    private readonly supplierRepo: ISupplierRepository,
    private readonly withholdingConceptRepo: IWithholdingConceptRepository,
    private readonly postPurchaseJournalEntry: PostPurchaseJournalEntryUseCase,
    private readonly generateElectronicSupportDocument: GenerateElectronicSupportDocumentUseCase,
    private readonly audit: AuditService
  ) {}

  async execute(data: CreatePurchaseInput): Promise<PurchaseRecord> {
    const supplier = await this.supplierRepo.findByIdOrThrow(data.supplierId);

    const expectedTotal = round2(data.subtotal + data.taxTotal);
    if (expectedTotal !== round2(data.total)) {
      throw new ValidationError(`El total (${data.total}) no coincide con subtotal + IVA (${expectedTotal})`);
    }

    // Retenciones que la empresa (compradora) le practica a este proveedor -- a diferencia de
    // ventas, aqui Contapro es quien retiene, ver post-purchase-journal-entry.use-case.ts. No
    // afectan `total` (el bruto legal de la factura del proveedor), solo lo que efectivamente se
    // le paga (ver PrismaPurchaseRepository.create, AccountPayable queda neto).
    let retentionTotal = 0;
    const computedWithholdings: ComputedPurchaseWithholding[] = [];
    for (const w of data.withholdings) {
      const concept = await this.withholdingConceptRepo.findByIdOrThrow(w.withholdingConceptId);
      if (!concept.isActive) {
        throw new ValidationError(`El concepto de retencion ${concept.code} esta inactivo`);
      }
      if (w.base > data.subtotal) {
        throw new ValidationError(`La base de retencion (${w.base}) no puede superar el subtotal de la compra (${data.subtotal})`);
      }
      const amount = calculateTax(w.base, concept.ratePercent);
      retentionTotal = round2(retentionTotal + amount);
      computedWithholdings.push({
        withholdingConceptId: concept.id,
        type: concept.type,
        base: w.base,
        ratePercent: concept.ratePercent,
        amount,
      });
    }

    const purchase = await this.purchaseRepo.create({ ...data, retentionTotal, withholdings: computedWithholdings });

    await this.audit.record({
      action: "PURCHASE_REGISTERED",
      entityType: "Purchase",
      entityId: purchase.id,
      description: `Compra registrada: factura ${purchase.invoiceNumber} por ${purchase.total}`,
    });

    const journalEntry = await this.postPurchaseJournalEntry.execute({
      purchaseId: purchase.id,
      branchId: purchase.branchId,
      date: purchase.createdAt,
      invoiceNumber: purchase.invoiceNumber,
      subtotal: purchase.subtotal,
      taxTotal: purchase.taxTotal,
      total: purchase.total,
      retentionTotal: purchase.retentionTotal,
      withholdingsByType: sumWithholdingsByType(purchase.withholdings),
      currency: purchase.currency,
      exchangeRate: purchase.exchangeRate,
    });
    if (journalEntry) {
      await this.purchaseRepo.setJournalEntryId(purchase.id, journalEntry.id);
      purchase.journalEntryId = journalEntry.id;
    }

    if (!supplier.isObligatedToInvoice) {
      // El proveedor no puede expedir su propia factura electronica -- la empresa, como
      // compradora, debe generar el documento soporte. No bloquea el registro de la compra si
      // falla (ej. sin resolucion de numeracion vigente para documento soporte).
      try {
        await this.generateElectronicSupportDocument.execute({
          purchaseId: purchase.id,
          branchId: purchase.branchId,
          supplierId: data.supplierId,
          issueDate: purchase.createdAt,
          subtotal: purchase.subtotal,
          taxTotal: purchase.taxTotal,
          total: purchase.total,
        });
      } catch (err) {
        await this.audit.record({
          action: "ELECTRONIC_SUPPORT_DOCUMENT_GENERATION_FAILED",
          entityType: "Purchase",
          entityId: purchase.id,
          description: `No se pudo generar el documento soporte electronico: ${(err as Error).message}`,
          metadata: {},
        });
      }
    }

    return purchase;
  }
}
