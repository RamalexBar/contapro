import { round2 } from "@erp/shared-utils";
import { ConflictError, ValidationError } from "../../../../shared/errors/app-error";
import type { AuditService } from "../../../audit/application/audit.service";
import type { AccountRecord, IChartOfAccountsRepository } from "../../domain/chart-of-accounts.repository";
import type { IFinancialPeriodRepository } from "../../domain/financial-period.repository";
import type { IJournalEntryRepository, JournalEntryRecord, PostedLineAggregate } from "../../domain/journal-entry.repository";
import type { CreateJournalEntryUseCase } from "./create-journal-entry.use-case";
import type { PostJournalEntryUseCase } from "./post-journal-entry.use-case";

/** sourceType del comprobante de cierre anual (sourceId = el año). Los reportes de resultados lo excluyen. */
export const ANNUAL_CLOSING_SOURCE = "AnnualClosing";

const PROFIT_ACCOUNT = { code: "3605", name: "Utilidad del ejercicio", type: "EQUITY" as const };
const LOSS_ACCOUNT = { code: "3610", name: "Perdida del ejercicio", type: "EQUITY" as const };

export interface ClosingLine {
  accountId: string;
  code: string;
  name: string;
  debit: number;
  credit: number;
}

export interface AnnualClosingPreview {
  year: number;
  /** Ya existe un cierre publicado de ese año. */
  alreadyClosed: boolean;
  closingEntryNumber: number | null;
  totalIncome: number;
  totalExpenses: number;
  /** Positivo = utilidad (credito a 3605); negativo = perdida (debito a 3610). */
  netIncome: number;
  lines: ClosingLine[];
}

/**
 * Cancela cada cuenta de resultados (ingresos 4, gastos 5, costos 6 y 7) con su saldo del año: debito a
 * los ingresos, credito a los gastos y costos. Funcion pura, sin la contrapartida de patrimonio.
 */
export function buildClosingLines(
  accounts: Pick<AccountRecord, "id" | "code" | "name" | "type">[],
  lines: Pick<PostedLineAggregate, "accountId" | "debit" | "credit" | "sourceType">[]
): { lines: ClosingLine[]; totalIncome: number; totalExpenses: number } {
  const byAccount = new Map<string, { debit: number; credit: number }>();
  for (const l of lines) {
    if (l.sourceType === ANNUAL_CLOSING_SOURCE) continue;
    const agg = byAccount.get(l.accountId) ?? { debit: 0, credit: 0 };
    agg.debit += l.debit;
    agg.credit += l.credit;
    byAccount.set(l.accountId, agg);
  }
  const result: ClosingLine[] = [];
  let totalIncome = 0;
  let totalExpenses = 0;
  for (const account of [...accounts].sort((a, b) => a.code.localeCompare(b.code))) {
    const agg = byAccount.get(account.id);
    if (!agg) continue;
    if (account.type === "INCOME") {
      const balance = round2(agg.credit - agg.debit);
      if (balance === 0) continue;
      totalIncome = round2(totalIncome + balance);
      result.push({ accountId: account.id, code: account.code, name: account.name, debit: balance > 0 ? balance : 0, credit: balance < 0 ? -balance : 0 });
    } else if (account.type === "EXPENSE") {
      const balance = round2(agg.debit - agg.credit);
      if (balance === 0) continue;
      totalExpenses = round2(totalExpenses + balance);
      result.push({ accountId: account.id, code: account.code, name: account.name, debit: balance < 0 ? -balance : 0, credit: balance > 0 ? balance : 0 });
    }
  }
  return { lines: result, totalIncome, totalExpenses };
}

/**
 * Cierre contable anual: un comprobante al 31 de diciembre que deja en cero las cuentas de resultados
 * y lleva la utilidad a 3605 (o la perdida a 3610). Antes Contapro no lo hacia: el Balance mostraba
 * "resultados sin cerrar" acumulados de todos los años.
 *
 * - Se hace despues de registrar el impuesto de renta del año y antes de cerrar diciembre (el
 *   comprobante lleva fecha del 31 de diciembre y un mes cerrado no admite comprobantes).
 * - Un cierre por año; para rehacerlo, se anula el comprobante en el Libro Diario y se vuelve a cerrar.
 * - El Estado de Resultados y los estados NIIF excluyen este comprobante, asi que el año cerrado sigue
 *   mostrando sus ingresos y gastos.
 * - El traslado de 3605 a utilidades acumuladas (3705) o su distribucion lo decide la asamblea: se
 *   registra a mano en el año siguiente.
 */
export class AnnualClosingUseCase {
  constructor(
    private readonly accountRepo: IChartOfAccountsRepository,
    private readonly journalRepo: IJournalEntryRepository,
    private readonly periodRepo: IFinancialPeriodRepository,
    private readonly createEntry: CreateJournalEntryUseCase,
    private readonly postEntry: PostJournalEntryUseCase,
    private readonly audit: AuditService
  ) {}

  async preview(year: number): Promise<AnnualClosingPreview> {
    this.assertYear(year);
    const existing = await this.existingClosing(year);
    const [accounts, lines] = await Promise.all([
      this.accountRepo.list(),
      this.journalRepo.listPostedLines({ from: new Date(Date.UTC(year, 0, 1)), to: new Date(Date.UTC(year, 11, 31, 23, 59, 59)) }),
    ]);
    const built = buildClosingLines(accounts, lines);
    return {
      year,
      alreadyClosed: Boolean(existing),
      closingEntryNumber: existing?.number ?? null,
      totalIncome: built.totalIncome,
      totalExpenses: built.totalExpenses,
      netIncome: round2(built.totalIncome - built.totalExpenses),
      lines: built.lines,
    };
  }

  async execute(year: number): Promise<JournalEntryRecord> {
    const preview = await this.preview(year);
    if (preview.alreadyClosed) {
      throw new ConflictError(`El año ${year} ya tiene cierre (comprobante #${preview.closingEntryNumber}). Para rehacerlo, anule ese comprobante en el Libro Diario.`);
    }
    if (preview.lines.length === 0) throw new ValidationError(`No hay movimientos de ingresos ni gastos en ${year}`);
    if (await this.periodRepo.findClosed(year, 12)) {
      throw new ConflictError(`Diciembre de ${year} esta cerrado: reabralo para registrar el cierre anual (lleva fecha del 31 de diciembre)`);
    }
    if (await this.journalRepo.hasDraftEntriesInPeriod(year, 12)) {
      throw new ValidationError(`Hay comprobantes en borrador en diciembre de ${year}: publiquelos o anulelos antes del cierre anual`);
    }

    const profit = preview.netIncome >= 0;
    const equity = await this.accountRepo.resolvePostingAccount(profit ? PROFIT_ACCOUNT : LOSS_ACCOUNT);
    const amount = Math.abs(preview.netIncome);
    const lines = preview.lines.map((l) => ({ accountId: l.accountId, debit: l.debit, credit: l.credit, description: `Cierre ${l.code} ${l.name}` }));
    if (amount > 0) {
      lines.push({
        accountId: equity.id,
        debit: profit ? 0 : amount,
        credit: profit ? amount : 0,
        description: profit ? `Utilidad del ejercicio ${year}` : `Perdida del ejercicio ${year}`,
      });
    }

    const entry = await this.createEntry.execute({
      date: new Date(Date.UTC(year, 11, 31, 12)),
      description: `Cierre contable del ejercicio ${year}`,
      type: "CLOSING",
      sourceType: ANNUAL_CLOSING_SOURCE,
      sourceId: String(year),
      lines,
    });
    const posted = await this.postEntry.execute(entry.id);

    await this.audit.record({
      action: "ANNUAL_CLOSING_POSTED",
      entityType: "JournalEntry",
      entityId: posted.id,
      description: `Cierre contable ${year}: ${profit ? "utilidad" : "perdida"} de ${amount} (comprobante #${posted.number})`,
      metadata: { year, netIncome: preview.netIncome },
    });
    return posted;
  }

  private async existingClosing(year: number): Promise<JournalEntryRecord | null> {
    const entry = await this.journalRepo.findBySource(ANNUAL_CLOSING_SOURCE, String(year));
    return entry && entry.status !== "VOID" ? entry : null;
  }

  private assertYear(year: number): void {
    if (!Number.isInteger(year) || year < 2000 || year > 2100) throw new ValidationError("Año invalido");
  }
}
