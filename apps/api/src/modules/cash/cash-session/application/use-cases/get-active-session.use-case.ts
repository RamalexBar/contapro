import type { CashSessionRecord, ICashSessionRepository } from "../../domain/cash-session.repository";

/** Sesion abierta de la caja + cuanto deberia haber en ella ahora (base + entradas - salidas de
 * efectivo), para que el cajero lo vea ANTES de contar y cerrar, no solo despues. */
export type ActiveCashSession = CashSessionRecord & { expectedAmount: number };

export class GetActiveSessionUseCase {
  constructor(private readonly repo: ICashSessionRepository) {}
  async execute(cashRegisterId: string): Promise<ActiveCashSession | null> {
    const session = await this.repo.findActiveByRegister(cashRegisterId);
    if (!session) return null;
    const net = await this.repo.sumMovements(session.id);
    return { ...session, expectedAmount: Math.round((session.openingAmount + net) * 100) / 100 };
  }
}
