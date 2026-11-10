import { describe, expect, it, vi } from "vitest";
import type { AccountRecord, IChartOfAccountsRepository } from "../../domain/chart-of-accounts.repository";
import type { IJournalEntryRepository, PostedLineAggregate } from "../../domain/journal-entry.repository";
import type { PostInventoryJournalEntryUseCase } from "./post-inventory-journal-entry.use-case";
import { RegularizeInventoryAccountUseCase } from "./regularize-inventory-account.use-case";

const accounts = [
  { id: "inv", code: "1435", name: "Inventarios", type: "ASSET" },
  { id: "inv-sub", code: "143501", name: "Mercancias", type: "ASSET" },
  { id: "caja", code: "1105", name: "Caja", type: "ASSET" },
] as AccountRecord[];

function line(accountId: string, debit: number, credit: number): PostedLineAggregate {
  return { id: "l", accountId, debit, credit, date: new Date(), entryId: "e", entryNumber: 1, description: null, sourceType: null, sourceId: null };
}

function makeUseCase(lines: PostedLineAggregate[], inventoryValue: number) {
  const accountRepo = { list: async () => accounts } as unknown as IChartOfAccountsRepository;
  const journalRepo = { listPostedLines: async () => lines } as unknown as IJournalEntryRepository;
  const post = { execute: vi.fn(async () => ({ id: "entry-1" })) };
  const useCase = new RegularizeInventoryAccountUseCase(
    accountRepo,
    journalRepo,
    { totalValue: async () => inventoryValue },
    post as unknown as PostInventoryJournalEntryUseCase
  );
  return { useCase, post };
}

describe("RegularizeInventoryAccountUseCase", () => {
  // Compras por 818.600 y costo de ventas por 1.587.776 (mas una subcuenta), contra un inventario real de 3.537.124.
  const lines = [line("inv", 818600, 0), line("inv", 0, 1587776), line("inv-sub", 500, 0), line("caja", 999, 0)];

  it("sin aplicar solo informa la diferencia (incluye subcuentas de la 1435, no otras cuentas)", async () => {
    const { useCase, post } = makeUseCase(lines, 3537124);
    const result = await useCase.execute({ apply: false });
    expect(result).toEqual({ ledgerBalance: -768676, inventoryValue: 3537124, difference: 4305800, entry: null });
    expect(post.execute).not.toHaveBeenCalled();
  });

  it("al aplicar registra la regularizacion por la diferencia con signo", async () => {
    const { useCase, post } = makeUseCase(lines, 3537124);
    const result = await useCase.execute({ apply: true });
    expect(post.execute).toHaveBeenCalledWith(expect.objectContaining({ kind: "REGULARIZATION", amount: 4305800, sourceType: "InventoryRegularization" }));
    expect(result.entry).toEqual({ id: "entry-1" });
  });

  it("no registra nada si ya cuadra", async () => {
    const { useCase, post } = makeUseCase([line("inv", 1000, 0)], 1000);
    const result = await useCase.execute({ apply: true });
    expect(result.difference).toBe(0);
    expect(post.execute).not.toHaveBeenCalled();
  });
});
