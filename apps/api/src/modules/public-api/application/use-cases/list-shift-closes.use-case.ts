import type { ExternalShiftCloseRecord, IExternalShiftCloseRepository } from "../../domain/external-shift-close.repository";

/** Para la pantalla del POS externo "que se contabilizo y que fallo" (pedido explicito del
 * usuario 2026-09-29). */
export class ListShiftClosesUseCase {
  constructor(private readonly repo: IExternalShiftCloseRepository) {}

  execute(filter?: { take?: number; skip?: number }): Promise<ExternalShiftCloseRecord[]> {
    return this.repo.list(filter);
  }
}
