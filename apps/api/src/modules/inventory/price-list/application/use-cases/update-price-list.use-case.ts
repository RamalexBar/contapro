import type { AuditService } from "../../../../audit/application/audit.service";
import type { IPriceListRepository, PriceListRecord, UpdatePriceListData } from "../../domain/price-list.repository";

export class UpdatePriceListUseCase {
  constructor(private readonly repo: IPriceListRepository, private readonly audit: AuditService) {}

  async execute(id: string, data: UpdatePriceListData): Promise<PriceListRecord> {
    const priceList = await this.repo.update(id, data);

    await this.audit.record({
      action: "PRICE_LIST_UPDATED",
      entityType: "PriceList",
      entityId: priceList.id,
      description: `Lista de precios actualizada: ${priceList.code} ${priceList.name}`,
    });

    return priceList;
  }
}
