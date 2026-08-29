import type { AuditService } from "../../../audit/application/audit.service";
import { type AccountRecord, type CreateAccountData, type IChartOfAccountsRepository } from "../../domain/chart-of-accounts.repository";

/**
 * Crea una cuenta del plan de cuentas. Si tiene cuenta padre, ademas de crearla desactiva
 * `acceptsEntries` en el padre si hace falta -- una cuenta base (clase/grupo/cuenta) que gana una
 * subcuenta/auxiliar pasa a ser solo de clasificacion, aplica parejo a TODAS las cuentas, incluidas
 * las que el motor contable ya postea de entrada (Caja general, Bancos, etc. -- ver
 * STANDARD_ACCOUNTS en cada Post*JournalEntryUseCase): esos casos de uso resuelven la cuenta real
 * donde postear via IChartOfAccountsRepository.resolvePostingAccount en vez de asumir que el
 * codigo raiz siempre acepta movimientos, asi que subdividir esas cuentas ya no rompe la
 * contabilizacion automatica (antes era una excepcion documentada, ver historial de este archivo).
 */
export class CreateAccountUseCase {
  constructor(private readonly repo: IChartOfAccountsRepository, private readonly audit: AuditService) {}

  async execute(data: CreateAccountData): Promise<AccountRecord> {
    const account = await this.repo.create(data);

    await this.audit.record({
      action: "ACCOUNT_CREATED",
      entityType: "ChartOfAccounts",
      entityId: account.id,
      description: `Cuenta creada: ${account.code} ${account.name}`,
    });

    if (data.parentId) {
      await this.disableParentDirectEntriesIfNeeded(data.parentId);
    }

    return account;
  }

  private async disableParentDirectEntriesIfNeeded(parentId: string): Promise<void> {
    const parent = await this.repo.findByIdOrThrow(parentId);
    if (!parent.acceptsEntries) return;

    const updated = await this.repo.disableDirectEntries(parent.id);

    await this.audit.record({
      action: "ACCOUNT_ENTRIES_DISABLED",
      entityType: "ChartOfAccounts",
      entityId: updated.id,
      description: `Cuenta ${updated.code} ${updated.name} dejo de admitir movimientos directos al agregarle una subcuenta/auxiliar`,
    });
  }
}
