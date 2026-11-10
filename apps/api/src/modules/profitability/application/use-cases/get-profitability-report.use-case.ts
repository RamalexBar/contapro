import type { IProfitabilityReader, ProfitabilityFilter } from "../../domain/profitability.reader";
import { buildProfitabilityReport, type ProfitabilityGroupBy, type ProfitabilityReport } from "../build-profitability-report";

export class GetProfitabilityReportUseCase {
  constructor(private readonly reader: IProfitabilityReader) {}

  async execute(filter: ProfitabilityFilter & { groupBy: ProfitabilityGroupBy }): Promise<ProfitabilityReport> {
    const lines = await this.reader.listLines(filter);
    return buildProfitabilityReport(lines, filter.groupBy);
  }
}
