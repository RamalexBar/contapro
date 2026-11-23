import { describe, expect, it } from "vitest";
import type { IChartOfAccountsRepository } from "../../domain/chart-of-accounts.repository";
import type { CreateJournalEntryUseCase } from "./create-journal-entry.use-case";
import type { PostJournalEntryUseCase } from "./post-journal-entry.use-case";
import { PostBenefitSettlementJournalEntryUseCase } from "./post-benefit-settlement-journal-entry.use-case";

type Line = { accountId: string; debit: number; credit: number };

function setup() {
  const captured: { lines: Line[] }[] = [];
  const useCase = new PostBenefitSettlementJournalEntryUseCase(
    { resolvePostingAccount: async (def: { code: string }) => ({ id: def.code }) } as unknown as IChartOfAccountsRepository,
    {
      execute: async (input: { lines: Line[] }) => {
        captured.push(input);
        return { id: "je" };
      },
    } as unknown as CreateJournalEntryUseCase,
    { execute: async () => ({ id: "je" }) } as unknown as PostJournalEntryUseCase
  );
  return { useCase, captured };
}

const sum = (lines: Line[], key: "debit" | "credit") => Math.round(lines.reduce((s, l) => s + l[key], 0) * 100) / 100;
const byAccount = (lines: Line[], id: string) => lines.find((l) => l.accountId === id);

describe("PostBenefitSettlementJournalEntryUseCase", () => {
  it("uses the provision, expenses the excess, sends cesantias to the fund and is balanced", async () => {
    const { useCase, captured } = setup();
    await useCase.execute({
      date: new Date("2026-12-31"),
      description: "Cesantias 2026",
      sourceId: "b1",
      settlements: [
        {
          lines: [
            { concept: "SEVERANCE", amount: 2_000_000, provisioned: 1_900_000 },
            { concept: "SEVERANCE_INTEREST", amount: 240_000, provisioned: 250_000 },
          ],
          withholding: 0,
          netPay: 240_000,
          toSeveranceFund: 2_000_000,
        },
      ],
    });
    const lines = captured[0].lines;
    expect(byAccount(lines, "2610")?.debit).toBe(2_150_000);
    expect(byAccount(lines, "510530")?.debit).toBe(100_000); // cesantias por encima de lo provisionado
    expect(byAccount(lines, "5108")?.credit).toBe(10_000); // intereses provisionados de mas
    expect(byAccount(lines, "2510")?.credit).toBe(2_000_000);
    expect(byAccount(lines, "2505")?.credit).toBe(240_000);
    expect(sum(lines, "debit")).toBe(sum(lines, "credit"));
  });

  it("indemnity has no provision: all of it is expense, withholding goes to 236505", async () => {
    const { useCase, captured } = setup();
    await useCase.execute({
      date: new Date("2026-11-15"),
      description: "Liquidacion",
      sourceId: "b2",
      settlements: [{ lines: [{ concept: "INDEMNITY", amount: 30_000_000, provisioned: 0 }], withholding: 6_000_000, netPay: 24_000_000, toSeveranceFund: 0 }],
    });
    const lines = captured[0].lines;
    expect(byAccount(lines, "510560")?.debit).toBe(30_000_000);
    expect(byAccount(lines, "236505")?.credit).toBe(6_000_000);
    expect(sum(lines, "debit")).toBe(sum(lines, "credit"));
  });
});
