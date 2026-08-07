import { ValidationError } from "../../../../../shared/errors/app-error";
import type { AuditService } from "../../../../audit/application/audit.service";
import type { IProductRepository } from "../../../product/domain/product.repository";
import type { IPriceListRepository, ProductPriceRecord } from "../../domain/price-list.repository";

export interface SetProductPriceInput {
  priceListId: string;
  productId: string;
  price: number;
}

export class SetProductPriceUseCase {
  constructor(
    private readonly priceListRepo: IPriceListRepository,
    private readonly productRepo: IProductRepository,
    private readonly audit: AuditService
  ) {}

  async execute(input: SetProductPriceInput): Promise<ProductPriceRecord> {
    const priceList = await this.priceListRepo.findByIdOrThrow(input.priceListId);
    if (!priceList.isActive) {
      throw new ValidationError(`La lista de precios ${priceList.code} ${priceList.name} esta inactiva`);
    }
    const product = await this.productRepo.findByIdOrThrow(input.productId);

    const entry = await this.priceListRepo.upsertProductPrice(input.priceListId, input.productId, input.price);

    await this.audit.record({
      action: "PRICE_LIST_PRODUCT_PRICE_SET",
      entityType: "PriceList",
      entityId: priceList.id,
      description: `Precio de ${product.toProps.name} en ${priceList.code} fijado en ${input.price}`,
    });

    return entry;
  }
}
