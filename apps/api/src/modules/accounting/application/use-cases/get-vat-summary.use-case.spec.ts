import { describe, expect, it } from "vitest";
import type { AccountRecord, IChartOfAccountsRepository } from "../../domain/chart-of-accounts.repository";
import type { IJournalEntryRepository, PostedLineAggregate } from "../../domain/journal-entry.repository";
import type { IVatActivityReader, TaxableActivity } from "../../domain/vat-activity.reader";
import { GetVatSummaryUseCase } from "./get-vat-summary.use-case";

const account = (id: string, code: string): AccountRecord => ({
  id,
  code,
  name: code,
  type: "LIABILITY",
  parentId: null,
  level: 4,
  isActive: true,
  acceptsEntries: true,
});

let lineSeq = 0;
const line = (accountId: string, sourceType: string | null, debit: number, credit: number): PostedLineAggregate => ({
  id: `l-${++lineSeq}`,
  accountId,
  debit,
  credit,
  date: new Date("2026-03-10T12:00:00Z"),
  entryId: `e-${lineSeq}`,
  entryNumber: lineSeq,
  description: null,
  sourceType,
  sourceId: null,
});

function makeUseCase(lines: PostedLineAggregate[], activity: TaxableActivity) {
  const accounts = [account("iva", "2408"), account("inc", "240810"), account("caja", "1105")];
  const accountRepo = { list: async () => accounts } as unknown as IChartOfAccountsRepository;
  const journalRepo = {
    listPostedLines: async (filter: { accountId?: string }) => lines.filter((l) => !filter.accountId || l.accountId === filter.accountId),
  } as unknown as IJournalEntryRepository;
  const reader: IVatActivityReader = { getTaxableActivity: async () => activity };
  return new GetVatSummaryUseCase(journalRepo, accountRepo, reader);
}

const period = [new Date("2026-03-01T05:00:00Z"), new Date("2026-05-01T04:59:59Z")] as const;

describe("GetVatSummaryUseCase", () => {
  it("nets generated VAT (credits to 2408) against deductible VAT (debits) and groups them by origin", async () => {
    const useCase = makeUseCase(
      [
        line("iva", "ExternalShiftClose", 0, 19_000),
        line("iva", "ExternalShiftClose", 0, 3_800),
        line("iva", "Sale", 0, 1_900),
        line("iva", "Purchase", 9_500, 0),
        line("iva", "Expense", 1_000, 0),
        line("iva", "Return", 380, 0),
        line("inc", "ExternalShiftClose", 0, 8_000),
        line("caja", "ExternalShiftClose", 50_000, 0),
      ],
      { sales: [], returns: [], shiftClosesWithoutDetail: 0 }
    );

    const summary = await useCase.execute(...period);

    expect(summary.generated).toBe(24_700);
    expect(summary.deductible).toBe(10_880);
    expect(summary.balance).toBe(13_820);
    expect(summary.consumptionTax).toBe(8_000);
    expect(summary.byOrigin.find((o) => o.origin === "ExternalShiftClose")).toMatchObject({ generated: 22_800, deductible: 0 });
    expect(summary.byOrigin.find((o) => o.origin === "Purchase")).toMatchObject({ label: "Compras a proveedores", deductible: 9_500 });
  });

  it("reports a balance in favor when deductible VAT exceeds generated VAT", async () => {
    const summary = await makeUseCase([line("iva", "Sale", 0, 1_000), line("iva", "Purchase", 4_000, 0)], {
      sales: [],
      returns: [],
      shiftClosesWithoutDetail: 0,
    }).execute(...period);

    expect(summary.balance).toBe(-3_000);
  });

  it("adds sales and returns per tax rate, IVA first and highest rate first", async () => {
    const summary = await makeUseCase([], {
      sales: [
        { taxType: "EXCLUDED", taxRate: 0, taxableBase: 5_000, taxAmount: 0 },
        { taxType: "IVA", taxRate: 5, taxableBase: 10_000, taxAmount: 500 },
        { taxType: "IVA", taxRate: 19, taxableBase: 100_000, taxAmount: 19_000 },
        { taxType: "IVA", taxRate: 19, taxableBase: 20_000, taxAmount: 3_800 },
      ],
      returns: [{ taxType: "IVA", taxRate: 19, taxableBase: 2_000, taxAmount: 380 }],
      shiftClosesWithoutDetail: 2,
    }).execute(...period);

    expect(summary.byRate.map((r) => `${r.taxType} ${r.taxRate}`)).toEqual(["IVA 19", "IVA 5", "EXCLUDED 0"]);
    expect(summary.byRate[0]).toEqual({ taxType: "IVA", taxRate: 19, salesBase: 120_000, salesTax: 22_800, returnsBase: 2_000, returnsTax: 380 });
    expect(summary.shiftClosesWithoutDetail).toBe(2);
  });

  it("returns zeros for a company without the 2408 account", async () => {
    const useCase = new GetVatSummaryUseCase(
      { listPostedLines: async () => [] } as unknown as IJournalEntryRepository,
      { list: async () => [] } as unknown as IChartOfAccountsRepository,
      { getTaxableActivity: async () => ({ sales: [], returns: [], shiftClosesWithoutDetail: 0 }) }
    );
    expect(await useCase.execute(...period)).toMatchObject({ generated: 0, deductible: 0, balance: 0, byOrigin: [], byRate: [] });
  });
});
