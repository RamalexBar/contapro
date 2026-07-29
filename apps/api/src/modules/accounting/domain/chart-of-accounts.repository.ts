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
}
