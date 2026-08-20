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

export interface IChartOfAccountsRepository {
  create(data: CreateAccountData): Promise<AccountRecord>;
  list(): Promise<AccountRecord[]>;
  findByCode(code: string): Promise<AccountRecord | null>;
  findByIdOrThrow(id: string): Promise<AccountRecord>;
  /** Crea la cuenta si el codigo no existe todavia; usado para las cuentas estandar de nomina. */
  upsertByCode(data: CreateAccountData): Promise<AccountRecord>;
  /** Activa/desactiva una cuenta del catalogo PUC (ver seedDefaultChartOfAccounts en
   * @erp/database) -- una cuenta inactiva no se puede usar en comprobantes nuevos, ver el
   * chequeo en CreateJournalEntryUseCase. */
  setActive(id: string, isActive: boolean): Promise<AccountRecord>;
  /** Baja acceptsEntries a false -- usado por CreateAccountUseCase cuando a una cuenta base
   * (clase/grupo/cuenta) se le agrega una subcuenta/auxiliar hija: la cuenta base pasa a ser solo
   * de clasificacion, el movimiento real queda en el hijo (convencion PUC). No-op si ya era
   * false. */
  disableDirectEntries(id: string): Promise<AccountRecord>;
}
