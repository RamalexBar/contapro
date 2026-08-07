import type { AuditService } from "../../../../audit/application/audit.service";
import type { CreatePriceListData, IPriceListRepository, PriceListRecord } from "../../domain/price-list.repository";

export class CreatePriceListUseCase {
  constructor(private readonly repo: IPriceListRepository, private readonly audit: AuditService) {}

  async execute(data: CreatePriceListData): Promise<PriceListRecord> {
    const priceList = await this.repo.create(data);

    await this.audit.record({
      action: "PRICE_LIST_CREATED",
      entityType: "PriceList",
      entityId: priceList.id,
      description: `Lista de precios creada: ${priceList.code} ${priceList.name}`,
    });

    return priceList;
  }
}
