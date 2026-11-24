import { describe, expect, it } from "vitest";
import type { IChartOfAccountsRepository } from "../../domain/chart-of-accounts.repository";
import type { CreateJournalEntryUseCase } from "./create-journal-entry.use-case";
import type { PostJournalEntryUseCase } from "./post-journal-entry.use-case";
import { PostPayrollJournalEntryUseCase } from "./post-payroll-journal-entry.use-case";

type Line = { accountId: string; debit: number; credit: number };

function setup() {
  const captured: { lines: Line[] }[] = [];
  const useCase = new PostPayrollJournalEntryUseCase(
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
const debitOf = (lines: Line[], id: string) => lines.filter((l) => l.accountId === id).reduce((s, l) => s + l.debit, 0);

describe("PostPayrollJournalEntryUseCase con novedades", () => {
  it("sends what the EPS/ARL pays to a receivable and vacation pay against the provision", async () => {
    const { useCase, captured } = setup();
    await useCase.execute({
      payrollId: "p1",
      year: 2026,
      month: 11,
      endDate: new Date("2026-11-30"),
      details: [
        {
          // Salario 1.000.000 + vacaciones 600.000 + incapacidad empleador 100.000 + EPS 300.000 = 2.000.000
          grossTotal: 2_000_000,
          netPay: 1_840_000,
          totalDeductions: 160_000,
          items: [
            { conceptCode: "SALARY", amount: 1_000_000 },
            { conceptCode: "VACATION_PAY", amount: 600_000 },
            { conceptCode: "SICK_LEAVE_EMPLOYER", amount: 100_000 },
            { conceptCode: "SICK_LEAVE_EPS", amount: 300_000 },
            { conceptCode: "HEALTH_EMPLOYEE", amount: 80_000 },
            { conceptCode: "PENSION_EMPLOYEE", amount: 80_000 },
            { conceptCode: "PENSION_EMPLOYER", amount: 240_000 },
            { conceptCode: "VACATION", amount: 83_400 },
          ],
        },
      ],
    });
    const lines = captured[0].lines;
    expect(debitOf(lines, "5105")).toBe(1_100_000); // salario + incapacidad dias 1-2
    expect(debitOf(lines, "138095")).toBe(300_000); // por cobrar a la EPS
    expect(debitOf(lines, "2610")).toBe(600_000); // vacaciones contra la provision
    expect(sum(lines, "debit")).toBe(sum(lines, "credit"));
  });
});
