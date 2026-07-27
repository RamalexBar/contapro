import type { CreateQuoteInput } from "@erp/shared-types";
import { getTenantContext } from "../../../../../shared/context/request-context";
import type { IQuoteRepository, QuoteRecord } from "../../domain/quote.repository";

export class CreateQuoteUseCase {
  constructor(private readonly repo: IQuoteRepository) {}

  async execute(input: CreateQuoteInput): Promise<QuoteRecord> {
    return this.repo.create({
      branchId: input.branchId,
      customerId: input.customerId,
      sellerUserId: getTenantContext().userId,
      validUntil: input.validUntil,
      items: input.items,
    });
  }
}
