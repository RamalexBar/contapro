import type { CreateQuoteInput } from "@erp/shared-types";
import { getTenantContext } from "../../../../../shared/context/request-context";
import type { ICustomerRepository } from "../../../../customers/domain/customer.repository";
import type { IPriceListRepository } from "../../../../inventory/price-list/domain/price-list.repository";
import { resolveEffectivePriceListId } from "../../../../inventory/price-list/application/resolve-effective-price-list-id";
import type { IQuoteRepository, QuoteRecord } from "../../domain/quote.repository";

export class CreateQuoteUseCase {
  constructor(
    private readonly repo: IQuoteRepository,
    private readonly customerRepo: ICustomerRepository,
    private readonly priceListRepo: IPriceListRepository
  ) {}

  async execute(input: CreateQuoteInput): Promise<QuoteRecord> {
    const priceListId = await resolveEffectivePriceListId(
      this.customerRepo,
      this.priceListRepo,
      input.priceListId,
      input.customerId
    );

    return this.repo.create({
      branchId: input.branchId,
      customerId: input.customerId,
      sellerUserId: getTenantContext().userId,
      validUntil: input.validUntil,
      items: input.items,
      priceListId,
    });
  }
}
