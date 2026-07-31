import type { AuditService } from "../../../audit/application/audit.service";
import type { FinancialPeriodRecord, IFinancialPeriodRepository } from "../../domain/financial-period.repository";

/** Reabre un periodo cerrado por error o para una correccion puntual. */
export class ReopenFinancialPeriodUseCase {
  constructor(
    private readonly periodRepo: IFinancialPeriodRepository,
    private readonly audit: AuditService
  ) {}

  async execute(year: number, month: number): Promise<FinancialPeriodRecord> {
    const reopened = await this.periodRepo.reopen(year, month);

    await this.audit.record({
      action: "FINANCIAL_PERIOD_REOPENED",
      entityType: "FinancialPeriod",
      entityId: reopened.id,
      description: `Periodo contable ${month}/${year} reabierto`,
    });

    return reopened;
  }
}
