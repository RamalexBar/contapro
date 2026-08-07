import type { AuditService } from "../../../../audit/application/audit.service";
import type { IProductRepository } from "../../../product/domain/product.repository";
import type { IPriceListRepository } from "../../domain/price-list.repository";

export interface RemoveProductPriceInput {
  priceListId: string;
  productId: string;
}

export class RemoveProductPriceUseCase {
  constructor(
    private readonly priceListRepo: IPriceListRepository,
    private readonly productRepo: IProductRepository,
    private readonly audit: AuditService
  ) {}

  async execute(input: RemoveProductPriceInput): Promise<void> {
    const priceList = await this.priceListRepo.findByIdOrThrow(input.priceListId);
    const product = await this.productRepo.findByIdOrThrow(input.productId);

    await this.priceListRepo.removeProductPrice(input.priceListId, input.productId);

    await this.audit.record({
      action: "PRICE_LIST_PRODUCT_PRICE_REMOVED",
      entityType: "PriceList",
      entityId: priceList.id,
      description: `Precio de ${product.toProps.name} en ${priceList.code} eliminado (vuelve al precio base)`,
    });
  }
}
