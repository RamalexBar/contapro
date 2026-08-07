import type { AuditService } from "../../../../audit/application/audit.service";
import type { IPriceListRepository, PriceListRecord } from "../../domain/price-list.repository";

export class DeactivatePriceListUseCase {
  constructor(private readonly repo: IPriceListRepository, private readonly audit: AuditService) {}

  async execute(id: string): Promise<PriceListRecord> {
    const priceList = await this.repo.deactivate(id);

    await this.audit.record({
      action: "PRICE_LIST_DEACTIVATED",
      entityType: "PriceList",
      entityId: priceList.id,
      description: `Lista de precios desactivada: ${priceList.code} ${priceList.name}`,
    });

    return priceList;
  }
}
