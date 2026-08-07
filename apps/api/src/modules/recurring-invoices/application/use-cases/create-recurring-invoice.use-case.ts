import { ValidationError } from "../../../../shared/errors/app-error";
import type { AuditService } from "../../../audit/application/audit.service";
import type { ICustomerRepository } from "../../../customers/domain/customer.repository";
import type { IProductRepository } from "../../../inventory/product/domain/product.repository";
import type { IPriceListRepository } from "../../../inventory/price-list/domain/price-list.repository";
import { calculateNextRunDate } from "../calculate-next-run-date";
import type {
  IRecurringInvoiceRepository,
  RecurringInvoiceItemInput,
  RecurringInvoiceRecord,
} from "../../domain/recurring-invoice.repository";

export interface CreateRecurringInvoiceInput {
  customerId: string;
  branchId: string;
  name: string;
  dayOfMonth: number;
  priceListId?: string;
  dueDays: number;
  items: RecurringInvoiceItemInput[];
}

export class CreateRecurringInvoiceUseCase {
  constructor(
    private readonly repo: IRecurringInvoiceRepository,
    private readonly customerRepo: ICustomerRepository,
    private readonly productRepo: IProductRepository,
    private readonly priceListRepo: IPriceListRepository,
    private readonly audit: AuditService
  ) {}

  async execute(input: CreateRecurringInvoiceInput): Promise<RecurringInvoiceRecord> {
    if (input.dayOfMonth < 1 || input.dayOfMonth > 28) {
      throw new ValidationError("El dia del mes debe estar entre 1 y 28");
    }
    if (input.items.length === 0) {
      throw new ValidationError("La plantilla debe tener al menos un producto");
    }

    const customer = await this.customerRepo.findByIdOrThrow(input.customerId);
    if (!customer.isActive) {
      throw new ValidationError(`El cliente ${customer.name} esta inactivo`);
    }

    for (const item of input.items) {
      await this.productRepo.findByIdOrThrow(item.productId);
    }

    if (input.priceListId) {
      const priceList = await this.priceListRepo.findByIdOrThrow(input.priceListId);
      if (!priceList.isActive) {
        throw new ValidationError(`La lista de precios ${priceList.code} ${priceList.name} esta inactiva`);
      }
    }

    const nextRunDate = calculateNextRunDate(input.dayOfMonth, new Date(), "seed");

    const recurringInvoice = await this.repo.create({ ...input, nextRunDate });

    await this.audit.record({
      action: "RECURRING_INVOICE_CREATED",
      entityType: "RecurringInvoice",
      entityId: recurringInvoice.id,
      description: `Plantilla de facturacion recurrente creada: ${recurringInvoice.name} (cliente ${customer.name})`,
    });

    return recurringInvoice;
  }
}
