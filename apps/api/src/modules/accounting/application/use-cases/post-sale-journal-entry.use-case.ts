import { round2 } from "@erp/shared-utils";
import type { IChartOfAccountsRepository } from "../../domain/chart-of-accounts.repository";
import type { JournalEntryRecord } from "../../domain/journal-entry.repository";
import { CreateJournalEntryUseCase } from "./create-journal-entry.use-case";
import { PostJournalEntryUseCase } from "./post-journal-entry.use-case";

const BANK_METHODS = new Set(["CARD", "TRANSFER", "MIXED"]);

const STANDARD_ACCOUNTS = {
  caja: { code: "1105", name: "Caja general", type: "ASSET" as const },
  bancos: { code: "1110", name: "Bancos", type: "ASSET" as const },
  clientes: { code: "1305", name: "Clientes (cuentas por cobrar)", type: "ASSET" as const },
  ingresosPorVentas: { code: "4135", name: "Comercio al por mayor y al por menor", type: "INCOME" as const },
  // Misma cuenta que usa PostPurchaseJournalEntryUseCase para el IVA descontable: el PUC
  // colombiano netea IVA generado (credito) e IVA descontable (debito) en la cuenta 2408.
  ivaPorPagar: { code: "2408", name: "Impuesto sobre las ventas por pagar", type: "LIABILITY" as const },
};

export interface SaleJournalEntryInput {
  saleId: string;
  branchId: string;
  date: Date;
  number: number;
  subtotal: number;
  discountTotal: number;
  taxTotal: number;
  total: number;
  payments: { method: string; amount: number }[];
}

/**
 * Contabiliza una venta COMPLETED: debito Caja (efectivo), Bancos (tarjeta/transferencia) y/o
 * Clientes (saldo no cubierto por los pagos registrados, ej. ventas a credito), credito
 * Ingresos por ventas (base gravable) + IVA generado. Las cuentas estandar se crean solas la
 * primera vez que se usan (upsertByCode), igual que en PostPayrollJournalEntryUseCase.
 */
export class PostSaleJournalEntryUseCase {
  constructor(
    private readonly accountRepo: IChartOfAccountsRepository,
    private readonly createEntry: CreateJournalEntryUseCase,
    private readonly postEntry: PostJournalEntryUseCase
  ) {}

  async execute(input: SaleJournalEntryInput): Promise<JournalEntryRecord | null> {
    if (input.total === 0) return null;

    const accounts = await this.ensureAccounts();
    const taxableBase = round2(input.subtotal - input.discountTotal);

    let cash = 0;
    let bank = 0;
    let otherPayments = 0;
    for (const payment of input.payments) {
      if (payment.method === "CASH") cash += payment.amount;
      else if (BANK_METHODS.has(payment.method)) bank += payment.amount;
      else otherPayments += payment.amount;
    }
    const paymentsTotal = round2(cash + bank + otherPayments);
    const receivable = round2(otherPayments + (input.total - paymentsTotal));

    const entry = await this.createEntry.execute({
      branchId: input.branchId,
      date: input.date,
      description: `Venta #${input.number}`,
      type: "SALE",
      sourceType: "Sale",
      sourceId: input.saleId,
      lines: [
        { accountId: accounts.caja.id, debit: round2(cash), credit: 0, description: "Efectivo" },
        { accountId: accounts.bancos.id, debit: round2(bank), credit: 0, description: "Tarjeta/transferencia" },
        { accountId: accounts.clientes.id, debit: receivable, credit: 0, description: "Ventas a credito" },
        { accountId: accounts.ingresosPorVentas.id, debit: 0, credit: taxableBase, description: "Ingreso por ventas" },
        { accountId: accounts.ivaPorPagar.id, debit: 0, credit: input.taxTotal, description: "IVA generado" },
      ].filter((line) => line.debit > 0 || line.credit > 0),
    });

    return this.postEntry.execute(entry.id);
  }

  private async ensureAccounts() {
    const entries = await Promise.all(
      Object.entries(STANDARD_ACCOUNTS).map(async ([key, def]) => {
        const account = await this.accountRepo.upsertByCode(def);
        return [key, account] as const;
      })
    );
    return Object.fromEntries(entries) as Record<keyof typeof STANDARD_ACCOUNTS, Awaited<ReturnType<IChartOfAccountsRepository["upsertByCode"]>>>;
  }
}
