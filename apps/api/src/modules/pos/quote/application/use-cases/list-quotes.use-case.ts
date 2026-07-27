import type { IQuoteRepository, QuoteRecord } from "../../domain/quote.repository";

export class ListQuotesUseCase {
  constructor(private readonly repo: IQuoteRepository) {}
  async execute(): Promise<QuoteRecord[]> {
    return this.repo.list();
  }
}
