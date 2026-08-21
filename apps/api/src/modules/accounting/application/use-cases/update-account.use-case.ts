import { ValidationError } from "../../../../shared/errors/app-error";
import type { AuditService } from "../../../audit/application/audit.service";
import {
  MAX_PRINCIPAL_ACCOUNT_LEVEL,
  type AccountRecord,
  type IChartOfAccountsRepository,
  type UpdateAccountData,
} from "../../domain/chart-of-accounts.repository";

/**
 * Renombra una cuenta del plan de cuentas. Las cuentas principales (clase/grupo/cuenta, nivel ≤
 * MAX_PRINCIPAL_ACCOUNT_LEVEL, siempre creadas por seedDefaultChartOfAccounts) son fijas -- solo
 * subcuentas y auxiliares (nivel > MAX_PRINCIPAL_ACCOUNT_LEVEL, creadas a mano por el usuario vía
 * CreateAccountUseCase) se pueden editar. Misma frontera que usa CreateAccountUseCase para
 * decidir si una cuenta padre deja de admitir movimientos.
 */
export class UpdateAccountUseCase {
  constructor(private readonly repo: IChartOfAccountsRepository, private readonly audit: AuditService) {}

  async execute(id: string, data: UpdateAccountData): Promise<AccountRecord> {
    const account = await this.repo.findByIdOrThrow(id);
    if (account.level <= MAX_PRINCIPAL_ACCOUNT_LEVEL) {
      throw new ValidationError(
        `La cuenta ${account.code} ${account.name} es una cuenta principal del PUC y no se puede editar -- solo subcuentas y auxiliares`
      );
    }

    const updated = await this.repo.update(id, data);

    await this.audit.record({
      action: "ACCOUNT_UPDATED",
      entityType: "ChartOfAccounts",
      entityId: updated.id,
      description: `Cuenta renombrada: ${updated.code} ${account.name} -> ${updated.name}`,
    });

    return updated;
  }
}
