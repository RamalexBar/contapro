import type { IBankReconciliationRepository } from "../../domain/bank-reconciliation.repository";
import type { IBankTransactionRepository } from "../../domain/bank-transaction.repository";
import type { IJournalEntryRepository } from "../../domain/journal-entry.repository";

const MAX_DAYS_APART = 5;
const DAY_MS = 86_400_000;

export interface SuggestedBankMatch {
  bankTransactionId: string;
  journalEntryLineId: string;
  amount: number;
  bankTransactionDate: Date;
  journalEntryDate: Date;
  journalEntryNumber: number;
  daysApart: number;
  confidence: "EXACT" | "PROBABLE";
}

/**
 * Sugerencias de conciliacion por monto exacto + cercania de fecha (maximo 5 dias de diferencia).
 * No filtra por cuenta contable porque no hay enlace en el schema entre BankAccount y una cuenta
 * de ChartOfAccounts (ver domain/bank-reconciliation.repository.ts) -- compara el monto de la
 * transaccion contra cualquier linea de comprobante POSTED de la empresa dentro de la ventana de
 * fechas. Es de solo lectura: no crea ningun BankReconciliationItem, el usuario confirma cada
 * sugerencia con POST /bank-reconciliations/:id/match (ya existente).
 *
 * Heuristica greedy (una linea candidata se usa como maximo en una sugerencia, la transaccion mas
 * temprana de la lista se queda con su mejor candidato primero) -- no es un matching optimo, es
 * una sugerencia para que el usuario confirme o descarte.
 */
export class SuggestBankReconciliationMatchesUseCase {
  constructor(
    private readonly reconciliationRepo: IBankReconciliationRepository,
    private readonly transactionRepo: IBankTransactionRepository,
    private readonly journalRepo: IJournalEntryRepository
  ) {}

  async execute(reconciliationId: string): Promise<SuggestedBankMatch[]> {
    const reconciliation = await this.reconciliationRepo.findByIdOrThrow(reconciliationId);

    const windowStart = new Date(reconciliation.periodStart);
    windowStart.setDate(windowStart.getDate() - MAX_DAYS_APART);
    const windowEnd = new Date(reconciliation.periodEnd);
    windowEnd.setDate(windowEnd.getDate() + MAX_DAYS_APART);

    const [transactions, lines, matchedLineIds] = await Promise.all([
      this.transactionRepo.list(reconciliation.bankAccountId),
      this.journalRepo.listPostedLines({ from: windowStart, to: windowEnd }),
      this.reconciliationRepo.listMatchedJournalEntryLineIds(),
    ]);

    const matchedLineIdSet = new Set(matchedLineIds);
    const unreconciledTransactions = transactions.filter((t) => !t.reconciled);
    const candidateLines = lines.filter((l) => !matchedLineIdSet.has(l.id));

    const usedLineIds = new Set<string>();
    const suggestions: SuggestedBankMatch[] = [];

    for (const tx of unreconciledTransactions) {
      let best: { line: (typeof candidateLines)[number]; daysApart: number } | null = null;

      for (const line of candidateLines) {
        if (usedLineIds.has(line.id)) continue;
        const lineAmount = line.debit !== 0 ? line.debit : line.credit;
        if (Math.abs(lineAmount - tx.amount) >= 0.01) continue;

        const daysApart = Math.round(Math.abs(tx.date.getTime() - line.date.getTime()) / DAY_MS);
        if (daysApart > MAX_DAYS_APART) continue;

        if (!best || daysApart < best.daysApart) best = { line, daysApart };
      }

      if (!best) continue;
      usedLineIds.add(best.line.id);
      suggestions.push({
        bankTransactionId: tx.id,
        journalEntryLineId: best.line.id,
        amount: tx.amount,
        bankTransactionDate: tx.date,
        journalEntryDate: best.line.date,
        journalEntryNumber: best.line.entryNumber,
        daysApart: best.daysApart,
        confidence: best.daysApart === 0 ? "EXACT" : "PROBABLE",
      });
    }

    return suggestions;
  }
}
