import { describe, expect, it } from "vitest";
import type { IChartOfAccountsRepository } from "../../domain/chart-of-accounts.repository";
import type { CreateJournalEntryUseCase } from "./create-journal-entry.use-case";
import type { PostJournalEntryUseCase } from "./post-journal-entry.use-case";
import { PostNoteJournalEntryUseCase } from "./post-note-journal-entry.use-case";

type Line = { accountId: string; debit: number; credit: number };

function setup() {
  const captured: { lines: Line[] }[] = [];
  const useCase = new PostNoteJournalEntryUseCase(
    { resolvePostingAccount: async (def: { code: string }) => ({ id: def.code }) } as unknown as IChartOfAccountsRepository,
    { execute: async (input: { lines: Line[] }) => (captured.push(input), { id: "je" }) } as unknown as CreateJournalEntryUseCase,
    { execute: async () => ({ id: "je" }) } as unknown as PostJournalEntryUseCase
  );
  return { useCase, captured };
}

const base = { noteId: "n1", branchId: "b1", date: new Date("2026-11-24"), description: "Nota" };

describe("PostNoteJournalEntryUseCase", () => {
  it("credit note: rebate in sales and IVA reversal against what is given back", async () => {
    const { useCase, captured } = setup();
    await useCase.execute({ ...base, kind: "CREDIT", base: 4_201.68, tax: 798.32, conceptCode: "3", settlement: "CASH" });
    expect(captured[0]!.lines).toEqual([
      expect.objectContaining({ accountId: "4175", debit: 4_201.68 }),
      expect.objectContaining({ accountId: "2408", debit: 798.32 }),
      expect.objectContaining({ accountId: "1105", credit: 5_000 }),
    ]);
  });

  it("debit note for late interest: charged to the customer account, no IVA, interest income", async () => {
    const { useCase, captured } = setup();
    await useCase.execute({ ...base, kind: "DEBIT", base: 2_000, tax: 0, conceptCode: "1", settlement: "CREDIT_TO_ACCOUNT" });
    expect(captured[0]!.lines).toEqual([
      expect.objectContaining({ accountId: "1305", debit: 2_000 }),
      expect.objectContaining({ accountId: "421005", credit: 2_000 }),
    ]);
  });
});
