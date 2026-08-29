import type { AuditService } from "../../../audit/application/audit.service";
import { ValidationError } from "../../../../shared/errors/app-error";
import type { AccountRecord, IChartOfAccountsRepository } from "../../domain/chart-of-accounts.repository";

/**
 * Reverso manual de "esta cuenta dejo de admitir movimientos directos al ganarle una subcuenta"
 * (ver CreateAccountUseCase): para cuando el usuario borro/desactivo todas las subcuentas que se
 * la habian apagado y quiere que la cuenta principal vuelva a recibir movimiento directo. Rechaza
 * si todavia le queda alguna subcuenta ACTIVA (permitir eso violaria la regla que motivo el fix de
 * raiz: dos niveles aceptando movimiento a la vez) -- una subcuenta inactiva no cuenta, ya no se
 * puede usar en comprobantes nuevos de todos modos.
 */
export class EnableAccountDirectEntriesUseCase {
  constructor(private readonly repo: IChartOfAccountsRepository, private readonly audit: AuditService) {}

  async execute(id: string): Promise<AccountRecord> {
    const account = await this.repo.findByIdOrThrow(id);
    if (account.acceptsEntries) return account;

    const all = await this.repo.list();
    const hasActiveChild = all.some((a) => a.parentId === id && a.isActive);
    if (hasActiveChild) {
      throw new ValidationError(
        `La cuenta ${account.code} ${account.name} todavia tiene subcuentas activas -- desactivalas primero si quieres que vuelva a admitir movimientos directos`
      );
    }

    const updated = await this.repo.enableDirectEntries(id);

    await this.audit.record({
      action: "ACCOUNT_ENTRIES_ENABLED",
      entityType: "ChartOfAccounts",
      entityId: updated.id,
      description: `Cuenta ${updated.code} ${updated.name} vuelve a admitir movimientos directos`,
    });

    return updated;
  }
}
