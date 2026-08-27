import { describe, expect, it } from "vitest";
import type {
  AddBankReconciliationMatchData,
  BankReconciliationRecord,
  IBankReconciliationRepository,
  StartBankReconciliationData,
} from "../../domain/bank-reconciliation.repository";
import type {
  BankTransactionRecord,
  CreateBankTransactionData,
  IBankTransactionRepository,
} from "../../domain/bank-transaction.repository";
import type {
  CreateJournalEntryData,
  IJournalEntryRepository,
  JournalEntryRecord,
  PostedLineAggregate,
} from "../../domain/journal-entry.repository";
import { SuggestBankReconciliationMatchesUseCase } from "./suggest-bank-reconciliation-matches.use-case";

const RECONCILIATION: BankReconciliationRecord = {
  id: "recon-1",
  bankAccountId: "bank-1",
  periodStart: new Date("2026-07-01"),
  periodEnd: new Date("2026-07-31"),
  statementBalance: 0,
  bookBalance: 0,
  status: "IN_PROGRESS",
  createdAt: new Date("2026-07-01"),
  items: [],
};

class FakeBankReconciliationRepo implements IBankReconciliationRepository {
  matchedLineIds: string[] = [];

  start(): Promise<BankReconciliationRecord> {
    throw new Error("not used in this spec");
  }
  findByIdOrThrow(): Promise<BankReconciliationRecord> {
    return Promise.resolve(RECONCILIATION);
  }
  list(): Promise<BankReconciliationRecord[]> {
    return Promise.resolve([RECONCILIATION]);
  }
  addMatch(_id: string, _data: AddBankReconciliationMatchData): Promise<BankReconciliationRecord> {
    throw new Error("not used in this spec");
  }
  close(): Promise<BankReconciliationRecord> {
    throw new Error("not used in this spec");
  }
  listMatchedJournalEntryLineIds(): Promise<string[]> {
    return Promise.resolve(this.matchedLineIds);
  }
}

class FakeBankTransactionRepo implements IBankTransactionRepository {
  constructor(private readonly transactions: BankTransactionRecord[]) {}

  create(_data: CreateBankTransactionData): Promise<BankTransactionRecord> {
    throw new Error("not used in this spec");
  }
  list(bankAccountId: string): Promise<BankTransactionRecord[]> {
    return Promise.resolve(this.transactions.filter((t) => t.bankAccountId === bankAccountId));
  }
  findByIdOrThrow(): Promise<BankTransactionRecord> {
    throw new Error("not used in this spec");
  }
  markReconciled(): Promise<void> {
    throw new Error("not used in this spec");
  }
  sumByType(): Promise<{ type: string; total: number }[]> {
    throw new Error("not used in this spec");
  }
}

class FakeJournalEntryRepo implements IJournalEntryRepository {
  constructor(private readonly lines: PostedLineAggregate[]) {}

  create(_data: CreateJournalEntryData): Promise<JournalEntryRecord> {
    throw new Error("not used in this spec");
  }
  list(): Promise<JournalEntryRecord[]> {
    throw new Error("not used in this spec");
  }
  findByIdOrThrow(): Promise<JournalEntryRecord> {
    throw new Error("not used in this spec");
  }
  updateStatus(): Promise<JournalEntryRecord> {
    throw new Error("not used in this spec");
  }
  listPostedLines(filter: { from?: Date; to?: Date }): Promise<PostedLineAggregate[]> {
    return Promise.resolve(
      this.lines.filter((l) => (!filter.from || l.date >= filter.from) && (!filter.to || l.date <= filter.to))
    );
  }
  hasDraftEntriesInPeriod(): Promise<boolean> {
    throw new Error("not used in this spec");
  }
  findBySource(): Promise<JournalEntryRecord | null> {
    throw new Error("not used in this spec");
  }
}

function makeTx(overrides: Partial<BankTransactionRecord> = {}): BankTransactionRecord {
  return {
    id: "tx-1",
    bankAccountId: "bank-1",
    date: new Date("2026-07-10"),
    description: "Transferencia",
    amount: 100_000,
    type: "CREDIT",
    reconciled: false,
    ...overrides,
  };
}

function makeLine(overrides: Partial<PostedLineAggregate> = {}): PostedLineAggregate {
  return {
    id: "line-1",
    accountId: "acc-1",
    debit: 100_000,
    credit: 0,
    date: new Date("2026-07-10"),
    entryId: "entry-1",
    entryNumber: 1,
    description: "Comprobante de venta",
    sourceType: null,
    sourceId: null,
    ...overrides,
  };
}

describe("SuggestBankReconciliationMatchesUseCase", () => {
  it("suggests an EXACT match when amount and date match exactly", async () => {
    const useCase = new SuggestBankReconciliationMatchesUseCase(
      new FakeBankReconciliationRepo(),
      new FakeBankTransactionRepo([makeTx()]),
      new FakeJournalEntryRepo([makeLine()])
    );

    const suggestions = await useCase.execute("recon-1");

    expect(suggestions).toEqual([
      expect.objectContaining({ bankTransactionId: "tx-1", journalEntryLineId: "line-1", confidence: "EXACT", daysApart: 0 }),
    ]);
  });

  it("suggests a PROBABLE match when amount matches but the date is a few days apart", async () => {
    const useCase = new SuggestBankReconciliationMatchesUseCase(
      new FakeBankReconciliationRepo(),
      new FakeBankTransactionRepo([makeTx({ date: new Date("2026-07-10") })]),
      new FakeJournalEntryRepo([makeLine({ date: new Date("2026-07-13") })])
    );

    const suggestions = await useCase.execute("recon-1");

    expect(suggestions).toEqual([expect.objectContaining({ confidence: "PROBABLE", daysApart: 3 })]);
  });

  it("does not suggest a match when the amount differs, even if the date matches", async () => {
    const useCase = new SuggestBankReconciliationMatchesUseCase(
      new FakeBankReconciliationRepo(),
      new FakeBankTransactionRepo([makeTx({ amount: 100_000 })]),
      new FakeJournalEntryRepo([makeLine({ debit: 50_000 })])
    );

    expect(await useCase.execute("recon-1")).toEqual([]);
  });

  it("does not suggest a match when the date is more than 5 days apart", async () => {
    const useCase = new SuggestBankReconciliationMatchesUseCase(
      new FakeBankReconciliationRepo(),
      new FakeBankTransactionRepo([makeTx({ date: new Date("2026-07-10") })]),
      new FakeJournalEntryRepo([makeLine({ date: new Date("2026-07-20") })])
    );

    expect(await useCase.execute("recon-1")).toEqual([]);
  });

  it("excludes bank transactions already reconciled", async () => {
    const useCase = new SuggestBankReconciliationMatchesUseCase(
      new FakeBankReconciliationRepo(),
      new FakeBankTransactionRepo([makeTx({ reconciled: true })]),
      new FakeJournalEntryRepo([makeLine()])
    );

    expect(await useCase.execute("recon-1")).toEqual([]);
  });

  it("excludes journal entry lines already matched in another reconciliation", async () => {
    const reconciliationRepo = new FakeBankReconciliationRepo();
    reconciliationRepo.matchedLineIds = ["line-1"];
    const useCase = new SuggestBankReconciliationMatchesUseCase(
      reconciliationRepo,
      new FakeBankTransactionRepo([makeTx()]),
      new FakeJournalEntryRepo([makeLine()])
    );

    expect(await useCase.execute("recon-1")).toEqual([]);
  });

  it("never suggests the same journal entry line for two different transactions", async () => {
    const useCase = new SuggestBankReconciliationMatchesUseCase(
      new FakeBankReconciliationRepo(),
      new FakeBankTransactionRepo([
        makeTx({ id: "tx-1", date: new Date("2026-07-10") }),
        makeTx({ id: "tx-2", date: new Date("2026-07-11") }),
      ]),
      new FakeJournalEntryRepo([makeLine({ id: "line-1", date: new Date("2026-07-10") })])
    );

    const suggestions = await useCase.execute("recon-1");

    expect(suggestions).toHaveLength(1);
    expect(suggestions[0]).toMatchObject({ bankTransactionId: "tx-1", journalEntryLineId: "line-1" });
  });

  it("matches a line whose amount is on the credit side (not just debit)", async () => {
    const useCase = new SuggestBankReconciliationMatchesUseCase(
      new FakeBankReconciliationRepo(),
      new FakeBankTransactionRepo([makeTx({ amount: 75_000, type: "DEBIT" })]),
      new FakeJournalEntryRepo([makeLine({ debit: 0, credit: 75_000 })])
    );

    const suggestions = await useCase.execute("recon-1");
    expect(suggestions).toEqual([expect.objectContaining({ confidence: "EXACT" })]);
  });

  it("breaks a same-amount, same-date tie by description similarity instead of array order", async () => {
    // Dos comprobantes con el mismo monto y la misma fecha (empate total por fecha) -- la
    // transaccion del banco menciona al proveedor "Acme", que solo coincide con line-acme.
    // Antes de este cambio se quedaba con "line-otro" por ser la primera en la lista.
    const useCase = new SuggestBankReconciliationMatchesUseCase(
      new FakeBankReconciliationRepo(),
      new FakeBankTransactionRepo([makeTx({ description: "Transferencia Proveedor Acme SAS" })]),
      new FakeJournalEntryRepo([
        makeLine({ id: "line-otro", description: "Comprobante de venta" }),
        makeLine({ id: "line-acme", description: "Compra Proveedor Acme SAS" }),
      ])
    );

    const suggestions = await useCase.execute("recon-1");

    expect(suggestions).toEqual([
      expect.objectContaining({ journalEntryLineId: "line-acme", confidence: "EXACT" }),
    ]);
  });

  it("still prefers the closer date over a same-amount but textually similar candidate further away", async () => {
    // La cercania de fecha sigue siendo la señal principal: aunque "line-lejos" describe mejor la
    // transaccion, "line-cerca" esta el mismo dia y no deberia perder por texto.
    const useCase = new SuggestBankReconciliationMatchesUseCase(
      new FakeBankReconciliationRepo(),
      new FakeBankTransactionRepo([
        makeTx({ date: new Date("2026-07-10"), description: "Transferencia Proveedor Acme SAS" }),
      ]),
      new FakeJournalEntryRepo([
        makeLine({ id: "line-cerca", date: new Date("2026-07-10"), description: "Comprobante generico" }),
        makeLine({ id: "line-lejos", date: new Date("2026-07-13"), description: "Compra Proveedor Acme SAS" }),
      ])
    );

    const suggestions = await useCase.execute("recon-1");

    expect(suggestions).toEqual([
      expect.objectContaining({ journalEntryLineId: "line-cerca", confidence: "EXACT", daysApart: 0 }),
    ]);
  });
});
