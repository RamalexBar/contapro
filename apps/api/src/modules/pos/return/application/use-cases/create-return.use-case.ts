import { calculateTax, round2 } from "@erp/shared-utils";
import { getTenantContext } from "../../../../../shared/context/request-context";
import { ValidationError } from "../../../../../shared/errors/app-error";
import type { AuditService } from "../../../../audit/application/audit.service";
import type { PostReturnJournalEntryUseCase, RefundMethod } from "../../../../accounting/application/use-cases/post-return-journal-entry.use-case";
import type { ISaleRepository } from "../../../sale/domain/sale.repository";
import type { CreateReturnItemData, IReturnRepository, ReturnRecord } from "../../domain/return.repository";

const RETURNABLE_SALE_STATUSES = new Set(["COMPLETED", "RETURNED_PARTIAL"]);

export interface CreateReturnItemInput {
  saleItemId: string;
  quantity: number;
  restockedToBranch: boolean;
}

export interface CreateReturnInput {
  saleId: string;
  reason: string;
  refundMethod: RefundMethod;
  items: CreateReturnItemInput[];
}

/**
 * Registra una devolucion sobre una venta ya completada. Nunca confia en precio/impuesto que
 * venga del request -- los recalcula desde el `SaleItem` real (mismo criterio que
 * create-sale.use-case.ts usa `product.toProps.currentPrice`, no el precio del carrito).
 *
 * La validacion de "la cantidad devuelta (sumada a lo ya devuelto) no excede lo vendido" y la
 * transicion de `Sale.status` viven dentro de la transaccion Prisma de
 * `IReturnRepository.create` (mismo criterio que `RegisterSupplierPaymentUseCase` valida
 * `amount <= balance` dentro de su propia transaccion, para que dos devoluciones concurrentes del
 * mismo item no se sobregiren) -- por eso este caso de uso no necesita consultar aparte cuanto se
 * ha devuelto ya.
 */
export class CreateReturnUseCase {
  constructor(
    private readonly returnRepo: IReturnRepository,
    private readonly saleRepo: ISaleRepository,
    private readonly postReturnJournalEntry: PostReturnJournalEntryUseCase,
    private readonly audit: AuditService
  ) {}

  async execute(input: CreateReturnInput): Promise<ReturnRecord> {
    if (input.items.length === 0) {
      throw new ValidationError("La devolucion necesita al menos un item");
    }

    const sale = await this.saleRepo.findByIdOrThrow(input.saleId);
    if (!RETURNABLE_SALE_STATUSES.has(sale.status)) {
      throw new ValidationError(`No se puede crear una devolucion sobre una venta en estado ${sale.status}`);
    }

    let subtotal = 0;
    let taxTotal = 0;
    let total = 0;
    const items: CreateReturnItemData[] = [];

    for (const reqItem of input.items) {
      if (reqItem.quantity <= 0) {
        throw new ValidationError("La cantidad a devolver debe ser mayor a cero");
      }
      const saleItem = sale.items.find((i) => i.id === reqItem.saleItemId);
      if (!saleItem) {
        throw new ValidationError(`El item ${reqItem.saleItemId} no pertenece a la venta #${sale.number}`);
      }

      const lineSubtotal = round2(saleItem.unitPrice * reqItem.quantity);
      const taxAmount = calculateTax(lineSubtotal, saleItem.taxPercent);
      const lineTotal = round2(lineSubtotal + taxAmount);

      subtotal = round2(subtotal + lineSubtotal);
      taxTotal = round2(taxTotal + taxAmount);
      total = round2(total + lineTotal);

      items.push({
        saleItemId: saleItem.id,
        productId: saleItem.productId,
        quantity: reqItem.quantity,
        unitPrice: saleItem.unitPrice,
        total: lineTotal,
        restockedToBranch: reqItem.restockedToBranch,
      });
    }

    const created = await this.returnRepo.create({
      branchId: sale.branchId,
      saleId: sale.id,
      customerId: sale.customerId ?? undefined,
      reason: input.reason,
      total,
      createdByUserId: getTenantContext().userId,
      items,
    });

    await this.audit.record({
      action: "RETURN_CREATED",
      entityType: "Return",
      entityId: created.id,
      description: `Devolucion registrada sobre venta #${sale.number} por ${total}`,
      metadata: { saleId: sale.id, total },
    });

    await this.postReturnJournalEntry.execute({
      returnId: created.id,
      branchId: created.branchId,
      date: created.createdAt,
      subtotal,
      taxTotal,
      total,
      refundMethod: input.refundMethod,
      costOfGoodsSold: created.costTotal,
    });

    return created;
  }
}
