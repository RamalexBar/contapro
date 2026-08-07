import { ValidationError } from "../../../../shared/errors/app-error";
import type { AuditService } from "../../../audit/application/audit.service";
import type { IPriceListRepository } from "../../../inventory/price-list/domain/price-list.repository";
import type { CustomerRecord, ICustomerRepository } from "../../domain/customer.repository";

export class UpdateCustomerPriceListUseCase {
  constructor(
    private readonly repo: ICustomerRepository,
    private readonly priceListRepo: IPriceListRepository,
    private readonly audit: AuditService
  ) {}

  async execute(customerId: string, priceListId: string | null): Promise<CustomerRecord> {
    if (priceListId) {
      const priceList = await this.priceListRepo.findByIdOrThrow(priceListId);
      if (!priceList.isActive) {
        throw new ValidationError(`La lista de precios ${priceList.code} ${priceList.name} esta inactiva`);
      }
    }

    const customer = await this.repo.updatePriceList(customerId, priceListId);

    await this.audit.record({
      action: "CUSTOMER_PRICE_LIST_CHANGED",
      entityType: "Customer",
      entityId: customer.id,
      description: priceListId
        ? `Lista de precios de ${customer.name} cambiada a ${priceListId}`
        : `Lista de precios de ${customer.name} removida (vuelve al precio base)`,
    });

    return customer;
  }
}
