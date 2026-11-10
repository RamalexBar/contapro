import { PrismaProfitabilityReader } from "./infrastructure/prisma-profitability.reader";
import { GetProfitabilityReportUseCase } from "./application/use-cases/get-profitability-report.use-case";
import { ProfitabilityController } from "./interfaces/profitability.controller";

const getProfitabilityReport = new GetProfitabilityReportUseCase(new PrismaProfitabilityReader());

export const profitabilityController = new ProfitabilityController(getProfitabilityReport);
