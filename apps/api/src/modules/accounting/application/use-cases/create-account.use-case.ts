import type { AuditService } from "../../../audit/application/audit.service";
import {
  MAX_PRINCIPAL_ACCOUNT_LEVEL,
  type AccountRecord,
  type CreateAccountData,
  type IChartOfAccountsRepository,
} from "../../domain/chart-of-accounts.repository";

/** Codigos de 4 digitos ("cuenta") que el motor contable ya postea directamente en comprobantes
 * automaticos (ventas, compras, nomina, abonos, etc. -- ver STANDARD_ACCOUNTS en cada
 * Post*JournalEntryUseCase de application/use-cases/). Si el usuario les agrega una subcuenta/
 * auxiliar propia, esta cuenta NO se desactiva para movimientos directos como el resto del
 * catalogo -- haria falta reescribir esos 9 casos de uso para postear un nivel mas abajo, fuera
 * de alcance de este item (decision explicita, ver docs/ALCANCE.md item 44). */
const ENGINE_MANAGED_ACCOUNT_CODES = new Set([
  "1105",
  "1110",
  "1305",
  "1435",
  "1592",
  "2205",
  "2370",
  "2380",
  "2408",
  "2505",
  "2610",
  "4135",
  "4295",
  "5105",
  "5107",
  "5108",
  "5135",
  "5160",
  "5195",
  "6135",
]);

/**
 * Crea una cuenta del plan de cuentas. Si tiene cuenta padre, ademas de crearla verifica si la
 * cuenta padre debe dejar de admitir movimientos directos (ver ENGINE_MANAGED_ACCOUNT_CODES /
 * MAX_PRINCIPAL_ACCOUNT_LEVEL arriba) -- una cuenta base que gana una subcuenta/auxiliar pasa a
 * ser solo de clasificacion.
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
    if (parent.level > MAX_PRINCIPAL_ACCOUNT_LEVEL) return;
    if (ENGINE_MANAGED_ACCOUNT_CODES.has(parent.code)) return;

    const updated = await this.repo.disableDirectEntries(parent.id);

    await this.audit.record({
      action: "ACCOUNT_ENTRIES_DISABLED",
      entityType: "ChartOfAccounts",
      entityId: updated.id,
      description: `Cuenta ${updated.code} ${updated.name} dejo de admitir movimientos directos al agregarle una subcuenta/auxiliar`,
    });
  }
}
