import type { IBankReconciliationRepository } from "../../domain/bank-reconciliation.repository";
import type { IBankTransactionRepository } from "../../domain/bank-transaction.repository";
import type { IJournalEntryRepository } from "../../domain/journal-entry.repository";
import { descriptionSimilarity } from "../description-similarity";

const MAX_DAYS_APART = 5;
const DAY_MS = 86_400_000;

/**
 * Cuanto puede "pagar" una similitud de texto perfecta (1.0) en dias de diferencia de fecha al
 * elegir el mejor candidato dentro de `execute` mas abajo. Con 1.0, una coincidencia de
 * descripcion perfecta compensa como maximo 1 dia de distancia; nunca hace ganar a un candidato
 * mas lejano que el mas cercano por mas de eso. La cercania de fecha sigue siendo la señal
 * principal, el texto solo desempata entre candidatos con fechas parecidas.
 */
const SIMILARITY_TIEBREAK_WEIGHT = 1;

export interface SuggestedBankMatch {
  bankTransactionId: string;
  journalEntryLineId: string;
  amount: number;
  bankTransactionDate: Date;
  journalEntryDate: Date;
  journalEntryNumber: number;
  daysApart: number;
  confidence: "EXACT" | "PROBABLE";
  /** 0..1, similitud de texto entre la descripcion de la transaccion y la del comprobante --
   * informativo (se usa para desempatar, no para decidir si hay match). */
  descriptionSimilarity: number;
}

/**
 * Sugerencias de conciliacion por monto exacto + cercania de fecha (maximo 5 dias de diferencia),
 * desempatado por similitud de texto entre la descripcion del banco y la del comprobante cuando
 * hay varios candidatos con fechas parecidas (ver SIMILARITY_TIEBREAK_WEIGHT y
 * `description-similarity.ts`). No filtra por cuenta contable porque no hay enlace en el schema
 * entre BankAccount y una cuenta de ChartOfAccounts (ver domain/bank-reconciliation.repository.ts)
 * -- compara el monto de la transaccion contra cualquier linea de comprobante POSTED de la
 * empresa dentro de la ventana de fechas. Es de solo lectura: no crea ningun
 * BankReconciliationItem, el usuario confirma cada sugerencia con POST
 * /bank-reconciliations/:id/match (ya existente).
 *
 * Heuristica greedy (una linea candidata se usa como maximo en una sugerencia, la transaccion mas
 * temprana de la lista se queda con su mejor candidato primero) -- no es un matching optimo, es
 * una sugerencia para que el usuario confirme o descarte. Sigue siendo estrictamente 1 a 1: una
 * transaccion que en la realidad corresponde a la suma de varios comprobantes (o viceversa) no se
 * sugiere -- ver "Que sigue" en el README del modulo.
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
      let best: { line: (typeof candidateLines)[number]; daysApart: number; similarity: number; score: number } | null = null;

      for (const line of candidateLines) {
        if (usedLineIds.has(line.id)) continue;
        const lineAmount = line.debit !== 0 ? line.debit : line.credit;
        if (Math.abs(lineAmount - tx.amount) >= 0.01) continue;

        const daysApart = Math.round(Math.abs(tx.date.getTime() - line.date.getTime()) / DAY_MS);
        if (daysApart > MAX_DAYS_APART) continue;

        const similarity = descriptionSimilarity(tx.description, line.description);
        // Puntaje mas bajo = mejor candidato. La similitud de texto solo desempata entre
        // candidatos con fechas parecidas -- ver SIMILARITY_TIEBREAK_WEIGHT arriba.
        const score = daysApart - SIMILARITY_TIEBREAK_WEIGHT * similarity;

        if (!best || score < best.score) best = { line, daysApart, similarity, score };
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
        descriptionSimilarity: Math.round(best.similarity * 100) / 100,
      });
    }

    return suggestions;
  }
}
