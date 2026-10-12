import type { CashSessionRecord, ICashSessionRepository } from "../../domain/cash-session.repository";

export type CashSessionHistoryItem = CashSessionRecord & { openedByName: string | null; closedByName: string | null };

const DEFAULT_LIMIT = 20;

/** Historial de turnos de una caja: quien abrio y cerro, esperado, contado y diferencia. */
export class ListCashSessionsUseCase {
  constructor(private readonly repo: ICashSessionRepository) {}
  async execute(cashRegisterId: string, limit = DEFAULT_LIMIT): Promise<CashSessionHistoryItem[]> {
    const sessions = await this.repo.listByRegister(cashRegisterId, Math.min(Math.max(limit, 1), 100));
    const names = await this.repo.findUserNames(
      sessions.flatMap((s) => (s.closedByUserId ? [s.openedByUserId, s.closedByUserId] : [s.openedByUserId]))
    );
    return sessions.map((s) => ({
      ...s,
      openedByName: names.get(s.openedByUserId) ?? null,
      closedByName: s.closedByUserId ? (names.get(s.closedByUserId) ?? null) : null,
    }));
  }
}
