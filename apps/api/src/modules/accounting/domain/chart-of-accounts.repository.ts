export type AccountType = "ASSET" | "LIABILITY" | "EQUITY" | "INCOME" | "EXPENSE";

export interface AccountRecord {
  id: string;
  code: string;
  name: string;
  type: AccountType;
  parentId: string | null;
  level: number;
  isActive: boolean;
  acceptsEntries: boolean;
}

export interface CreateAccountData {
  code: string;
  name: string;
  type: AccountType;
  parentId?: string;
  acceptsEntries?: boolean;
}

export interface UpdateAccountData {
  name: string;
}

/** Nivel maximo (clase=1/grupo=2/cuenta=3) que se considera "cuenta principal" del PUC -- fija,
 * no editable, siempre creada por el seed estandar (ver seedDefaultChartOfAccounts en
 * @erp/database). De nivel 4 (subcuenta) para abajo es detalle que el usuario administra
 * libremente: editar el nombre (UpdateAccountUseCase) y agregar hijos sin apagar
 * `acceptsEntries` del padre (CreateAccountUseCase) -- misma frontera para ambas reglas. */
export const MAX_PRINCIPAL_ACCOUNT_LEVEL = 3;

export interface IChartOfAccountsRepository {
  create(data: CreateAccountData): Promise<AccountRecord>;
  list(): Promise<AccountRecord[]>;
  findByCode(code: string): Promise<AccountRecord | null>;
  findByIdOrThrow(id: string): Promise<AccountRecord>;
  /** Crea la cuenta si el codigo no existe todavia; usado para las cuentas estandar de nomina. */
  upsertByCode(data: CreateAccountData): Promise<AccountRecord>;
  /** Usado por todos los Post*JournalEntryUseCase en vez de upsertByCode directo: crea la cuenta
   * estandar si no existe (igual que upsertByCode) y ademas desciende por su cadena de subcuentas
   * hasta la mas profunda sin ambiguedad (exactamente un hijo en cada nivel) -- si el usuario
   * subdividio esa cuenta (ej. Caja general en Caja 1/Caja 2), el motor debe postear en el
   * auxiliar real, no en la cuenta de agrupacion que ya dejo de admitir movimientos (ver
   * CreateAccountUseCase). Si hay mas de un hijo en algun nivel no hay forma de saber cual eligio
   * el usuario para el motor -- se queda en ese nivel (CreateJournalEntryUseCase no exige
   * acceptsEntries para comprobantes automaticos, solo para MANUAL, asi que esto no rompe la
   * contabilizacion aunque esa cuenta puntual ya no acepte movimientos manuales). */
  resolvePostingAccount(data: CreateAccountData): Promise<AccountRecord>;
  /** Activa/desactiva una cuenta del catalogo PUC (ver seedDefaultChartOfAccounts en
   * @erp/database) -- una cuenta inactiva no se puede usar en comprobantes nuevos, ver el
   * chequeo en CreateJournalEntryUseCase. */
  setActive(id: string, isActive: boolean): Promise<AccountRecord>;
  /** Baja acceptsEntries a false -- usado por CreateAccountUseCase cuando a una cuenta base
   * (clase/grupo/cuenta) se le agrega una subcuenta/auxiliar hija: la cuenta base pasa a ser solo
   * de clasificacion, el movimiento real queda en el hijo (convencion PUC). No-op si ya era
   * false. */
  disableDirectEntries(id: string): Promise<AccountRecord>;
  /** Reverso manual de disableDirectEntries -- para cuando el usuario borra/desactiva todas las
   * subcuentas que le habian apagado el movimiento directo a una cuenta principal y quiere que
   * vuelva a admitirlo (ver EnableAccountDirectEntriesUseCase para la validacion de que no le
   * queden hijos activos). No-op si ya era true. */
  enableDirectEntries(id: string): Promise<AccountRecord>;
  /** Renombra una cuenta -- solo subcuentas/auxiliares (nivel > MAX_PRINCIPAL_ACCOUNT_LEVEL), la
   * validacion vive en UpdateAccountUseCase, no aca. */
  update(id: string, data: UpdateAccountData): Promise<AccountRecord>;
}
