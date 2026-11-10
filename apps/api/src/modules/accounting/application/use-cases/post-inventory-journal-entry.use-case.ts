import { round2 } from "@erp/shared-utils";
import type { IChartOfAccountsRepository } from "../../domain/chart-of-accounts.repository";
import type { JournalEntryRecord } from "../../domain/journal-entry.repository";
import { CreateJournalEntryUseCase } from "./create-journal-entry.use-case";
import { PostJournalEntryUseCase } from "./post-journal-entry.use-case";

const STANDARD_ACCOUNTS = {
  inventario: { code: "1435", name: "Inventarios - mercancias no fabricadas por la empresa", type: "ASSET" as const },
  aportes: { code: "3115", name: "Aportes sociales", type: "EQUITY" as const },
  sobrantes: { code: "4295", name: "Diversos (otros ingresos)", type: "INCOME" as const },
  faltantes: { code: "5195", name: "Diversos (gastos)", type: "EXPENSE" as const },
};

/**
 * - OPENING: existencias iniciales al crear/importar un producto -> Debito 1435 / Credito 3115.
 * - ENTRY: entrada manual de mercancia (sin compra registrada) -> Debito 1435 / Credito 3115.
 * - SURPLUS: ajuste a favor (sobrante de inventario) -> Debito 1435 / Credito 4295.
 * - SHORTAGE: ajuste en contra (faltante, dano, perdida) -> Debito 5195 / Credito 1435.
 * - REGULARIZATION: cuadre de la 1435 contra el inventario valorizado real; `amount` con signo
 *   (positivo = la 1435 estaba por debajo: Debito 1435 / Credito 3115; negativo, al reves).
 */
export type InventoryJournalKind = "OPENING" | "ENTRY" | "SURPLUS" | "SHORTAGE" | "REGULARIZATION";

export interface InventoryJournalEntryInput {
  kind: InventoryJournalKind;
  /** Costo real del movimiento (siempre positivo, salvo REGULARIZATION que lleva signo). */
  amount: number;
  date: Date;
  branchId?: string | null;
  sourceType: string;
  sourceId: string;
  description: string;
}

/**
 * Contabiliza los movimientos de inventario que no vienen de una compra ni de una venta (2026-11-10). Antes no generaban
 * asiento: la mercancia entraba al inventario fisico sin pasar por la 1435 y las ventas igual la descargaban, asi que la
 * cuenta quedaba en negativo. Contrapartida de las entradas sin factura: 3115 Aportes sociales (mercancia que el dueno
 * pone en el negocio), decidido con el usuario.
 */
export class PostInventoryJournalEntryUseCase {
  constructor(
    private readonly accountRepo: IChartOfAccountsRepository,
    private readonly createEntry: CreateJournalEntryUseCase,
    private readonly postEntry: PostJournalEntryUseCase
  ) {}

  async execute(input: InventoryJournalEntryInput): Promise<JournalEntryRecord | null> {
    const amount = round2(Math.abs(input.amount));
    if (amount < 0.01) return null;

    const accounts = await this.ensureAccounts();
    const increasesInventory =
      input.kind === "OPENING" || input.kind === "ENTRY" || input.kind === "SURPLUS" || (input.kind === "REGULARIZATION" && input.amount > 0);
    const counterpart =
      input.kind === "SURPLUS" ? accounts.sobrantes : input.kind === "SHORTAGE" ? accounts.faltantes : accounts.aportes;
    const counterpartLabel =
      input.kind === "SURPLUS" ? "Sobrante de inventario" : input.kind === "SHORTAGE" ? "Faltante de inventario" : "Aporte de mercancia";

    const entry = await this.createEntry.execute({
      branchId: input.branchId ?? undefined,
      date: input.date,
      description: input.description,
      type: "INVENTORY",
      sourceType: input.sourceType,
      sourceId: input.sourceId,
      lines: [
        {
          accountId: accounts.inventario.id,
          debit: increasesInventory ? amount : 0,
          credit: increasesInventory ? 0 : amount,
          description: "Inventario de mercancias",
        },
        {
          accountId: counterpart.id,
          debit: increasesInventory ? 0 : amount,
          credit: increasesInventory ? amount : 0,
          description: counterpartLabel,
        },
      ],
    });

    return this.postEntry.execute(entry.id);
  }

  private async ensureAccounts() {
    const entries = await Promise.all(
      Object.entries(STANDARD_ACCOUNTS).map(async ([key, def]) => {
        const account = await this.accountRepo.resolvePostingAccount(def);
        return [key, account] as const;
      })
    );
    return Object.fromEntries(entries) as Record<keyof typeof STANDARD_ACCOUNTS, Awaited<ReturnType<IChartOfAccountsRepository["resolvePostingAccount"]>>>;
  }
}
