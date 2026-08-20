import type { AuditService } from "../../../audit/application/audit.service";
import type { AccountRecord, IChartOfAccountsRepository } from "../../domain/chart-of-accounts.repository";

/** Activa o desactiva una cuenta del catalogo PUC (ver seedDefaultChartOfAccounts en
 * @erp/database, item del plan unico de cuentas precargado). Una cuenta desactivada no se puede
 * usar en comprobantes nuevos (ver el chequeo en CreateJournalEntryUseCase) pero sigue visible en
 * el catalogo para poder reactivarla. */
export class SetAccountActiveUseCase {
  constructor(private readonly repo: IChartOfAccountsRepository, private readonly audit: AuditService) {}

  async execute(id: string, isActive: boolean): Promise<AccountRecord> {
    const account = await this.repo.setActive(id, isActive);

    await this.audit.record({
      action: isActive ? "ACCOUNT_ACTIVATED" : "ACCOUNT_DEACTIVATED",
      entityType: "ChartOfAccounts",
      entityId: account.id,
      description: `Cuenta ${isActive ? "activada" : "desactivada"}: ${account.code} ${account.name}`,
    });

    return account;
  }
}
