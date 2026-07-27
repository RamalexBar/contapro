import { PrismaQuoteRepository } from "./infrastructure/prisma-quote.repository";
import { CreateQuoteUseCase } from "./application/use-cases/create-quote.use-case";
import { ListQuotesUseCase } from "./application/use-cases/list-quotes.use-case";
import { QuoteController } from "./interfaces/quote.controller";

const repo = new PrismaQuoteRepository();
export const quoteController = new QuoteController(new CreateQuoteUseCase(repo), new ListQuotesUseCase(repo));
