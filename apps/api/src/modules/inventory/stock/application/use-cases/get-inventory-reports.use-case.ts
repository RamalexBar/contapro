import type { IInventoryReportReader } from "../../domain/inventory-report.reader";
import { buildStockAlerts, buildValuationReport, type StockAlertRow, type ValuationReport } from "../inventory-reports";

export class GetInventoryValuationUseCase {
  constructor(private readonly reader: IInventoryReportReader) {}

  async execute(branchId?: string): Promise<ValuationReport> {
    return buildValuationReport(await this.reader.listStockLevels({ branchId, withLayers: true }));
  }
}

export class ListStockAlertsUseCase {
  constructor(private readonly reader: IInventoryReportReader) {}

  async execute(branchId?: string): Promise<StockAlertRow[]> {
    return buildStockAlerts(await this.reader.listStockLevels({ branchId, withLayers: false }));
  }
}
