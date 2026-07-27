import type { CashSessionRecord, ICashSessionRepository } from "../../domain/cash-session.repository";

export class GetActiveSessionUseCase {
  constructor(private readonly repo: ICashSessionRepository) {}
  async execute(cashRegisterId: string): Promise<CashSessionRecord | null> {
    return this.repo.findActiveByRegister(cashRegisterId);
  }
}
