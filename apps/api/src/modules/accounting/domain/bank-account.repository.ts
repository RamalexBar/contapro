export interface CreateBankAccountData {
  bankName: string;
  accountNumber: string;
  accountType: string;
}

export interface BankAccountRecord {
  id: string;
  bankName: string;
  accountNumber: string;
  accountType: string;
  currentBalance: number;
}

export interface IBankAccountRepository {
  create(data: CreateBankAccountData): Promise<BankAccountRecord>;
  list(): Promise<BankAccountRecord[]>;
  findByIdOrThrow(id: string): Promise<BankAccountRecord>;
}
