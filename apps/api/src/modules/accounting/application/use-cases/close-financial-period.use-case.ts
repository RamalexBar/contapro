import { ValidationError } from "../../../../shared/errors/app-error";
import type { AuditService } from "../../../audit/application/audit.service";
import type { FinancialPeriodRecord, IFinancialPeriodRepository } from "../../domain/financial-period.repository";
import type { IJournalEntryRepository } from "../../domain/journal-entry.repository";

/**
 * Cierra un periodo contable (mes): a partir de ese momento CreateJournalEntryUseCase rechaza
 * comprobantes nuevos con fecha dentro del periodo (manuales y automaticos desde venta/compra/
 * nomina/etc, todos pasan por ahi). No genera asiento de cierre (traslado de resultados a
 * patrimonio) -- el Balance General ya incorpora la utilidad acumulada dinamicamente (ver
 * AccountingReportsService), asi que "cerrar" aqui es un bloqueo de edicion, no un cierre contable
 * formal de libros.
 */
export class CloseFinancialPeriodUseCase {
  constructor(
    private readonly periodRepo: IFinancialPeriodRepository,
    private readonly journalRepo: IJournalEntryRepository,
    private readonly audit: AuditService
  ) {}

  async execute(year: number, month: number): Promise<FinancialPeriodRecord> {
    if (!Number.isInteger(month) || month < 1 || month > 12) {
      throw new ValidationError("Mes invalido (1-12)");
    }

    const hasDrafts = await this.journalRepo.hasDraftEntriesInPeriod(year, month);
    if (hasDrafts) {
      throw new ValidationError(
        `Hay comprobantes en borrador con fecha dentro de ${month}/${year}. Publicalos o anulalos antes de cerrar el periodo.`
      );
    }

    const closed = await this.periodRepo.close(year, month);

    await this.audit.record({
      action: "FINANCIAL_PERIOD_CLOSED",
      entityType: "FinancialPeriod",
      entityId: closed.id,
      description: `Periodo contable ${month}/${year} cerrado`,
    });

    return closed;
  }
}
