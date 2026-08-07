import { ValidationError } from "../../../../shared/errors/app-error";
import type { AuditService } from "../../../audit/application/audit.service";
import type { IProductRepository } from "../../../inventory/product/domain/product.repository";
import type { IPriceListRepository } from "../../../inventory/price-list/domain/price-list.repository";
import type {
  IRecurringInvoiceRepository,
  RecurringInvoiceRecord,
  UpdateRecurringInvoiceData,
} from "../../domain/recurring-invoice.repository";

export class UpdateRecurringInvoiceUseCase {
  constructor(
    private readonly repo: IRecurringInvoiceRepository,
    private readonly productRepo: IProductRepository,
    private readonly priceListRepo: IPriceListRepository,
    private readonly audit: AuditService
  ) {}

  async execute(id: string, data: UpdateRecurringInvoiceData): Promise<RecurringInvoiceRecord> {
    if (data.dayOfMonth !== undefined && (data.dayOfMonth < 1 || data.dayOfMonth > 28)) {
      throw new ValidationError("El dia del mes debe estar entre 1 y 28");
    }
    if (data.items !== undefined && data.items.length === 0) {
      throw new ValidationError("La plantilla debe tener al menos un producto");
    }
    if (data.items) {
      for (const item of data.items) {
        await this.productRepo.findByIdOrThrow(item.productId);
      }
    }
    if (data.priceListId) {
      const priceList = await this.priceListRepo.findByIdOrThrow(data.priceListId);
      if (!priceList.isActive) {
        throw new ValidationError(`La lista de precios ${priceList.code} ${priceList.name} esta inactiva`);
      }
    }

    const recurringInvoice = await this.repo.update(id, data);

    await this.audit.record({
      action: "RECURRING_INVOICE_UPDATED",
      entityType: "RecurringInvoice",
      entityId: recurringInvoice.id,
      description: `Plantilla de facturacion recurrente actualizada: ${recurringInvoice.name}`,
    });

    return recurringInvoice;
  }
}
