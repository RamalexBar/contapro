import type { CashSessionRecord, ICashSessionRepository } from "../../domain/cash-session.repository";

/** Sesion abierta de la caja + cuanto deberia haber en ella ahora (base + entradas - salidas de
 * efectivo), para que el cajero lo vea ANTES de contar y cerrar, no solo despues. Incluye quien
 * abrio el turno: la caja es una por sucursal, y quien entra debe saber si el turno es suyo. */
export type ActiveCashSession = CashSessionRecord & { expectedAmount: number; openedByName: string | null };

export class GetActiveSessionUseCase {
  constructor(private readonly repo: ICashSessionRepository) {}
  async execute(cashRegisterId: string): Promise<ActiveCashSession | null> {
    const session = await this.repo.findActiveByRegister(cashRegisterId);
    if (!session) return null;
    const net = await this.repo.sumMovements(session.id);
    const names = await this.repo.findUserNames([session.openedByUserId]);
    return {
      ...session,
      expectedAmount: Math.round((session.openingAmount + net) * 100) / 100,
      openedByName: names.get(session.openedByUserId) ?? null,
    };
  }
}
