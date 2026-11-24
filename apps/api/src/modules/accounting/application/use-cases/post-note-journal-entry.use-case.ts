import { round2 } from "@erp/shared-utils";
import type { IChartOfAccountsRepository } from "../../domain/chart-of-accounts.repository";
import type { JournalEntryRecord } from "../../domain/journal-entry.repository";
import type { CreateJournalEntryUseCase } from "./create-journal-entry.use-case";
import type { PostJournalEntryUseCase } from "./post-journal-entry.use-case";

const ACCOUNTS = {
  caja: { code: "1105", name: "Caja general", type: "ASSET" as const },
  bancos: { code: "1110", name: "Bancos", type: "ASSET" as const },
  clientes: { code: "1305", name: "Clientes (cuentas por cobrar)", type: "ASSET" as const },
  iva: { code: "2408", name: "Impuesto sobre las ventas por pagar", type: "LIABILITY" as const },
  // PUC: devoluciones, rebajas y descuentos en ventas (resta del ingreso).
  rebajas: { code: "4175", name: "Devoluciones, rebajas y descuentos en ventas", type: "INCOME" as const },
  ventas: { code: "4135", name: "Comercio al por mayor y al por menor", type: "INCOME" as const },
  intereses: { code: "421005", name: "Intereses", type: "INCOME" as const },
  recuperaciones: { code: "4250", name: "Recuperaciones", type: "INCOME" as const },
  diversos: { code: "4295", name: "Diversos (otros ingresos)", type: "INCOME" as const },
};

/** Como se le devuelve el valor de una nota credito al cliente (mismo criterio que una devolucion). */
export type NoteSettlement = "CASH" | "TRANSFER" | "CREDIT_TO_ACCOUNT";

/** Cuenta de ingreso de cada concepto de nota debito: 1 intereses, 2 gastos de cobranza, 3 cambio del valor, 4 otros. */
const DEBIT_INCOME_ACCOUNT: Record<string, keyof typeof ACCOUNTS> = { "1": "intereses", "2": "recuperaciones", "3": "ventas", "4": "diversos" };

export interface NoteJournalEntryInput {
  kind: "CREDIT" | "DEBIT";
  noteId: string;
  branchId: string;
  date: Date;
  /** Valor sin IVA y su IVA (de los renglones de la nota). */
  base: number;
  tax: number;
  conceptCode: string;
  /** Nota credito: como se devuelve. Nota debito: con cliente se carga a su cuenta (1305), sin cliente se cobra de contado. */
  settlement: NoteSettlement;
  description: string;
}

/**
 * Comprobante de una nota credito o debito libre (las de devoluciones ya las contabiliza la devolucion):
 * - Credito (rebaja, descuento, ajuste de precio): Debito 4175 por la base y 2408 por el IVA, Credito
 *   Caja, Bancos o Clientes segun como se devuelve.
 * - Debito (intereses, gastos de cobranza, cambio del valor, otros): Debito Clientes o Caja, Credito el
 *   ingreso del concepto (421005, 4250, 4135, 4295) y 2408 si lleva IVA.
 * Antes las notas libres no contabilizaban nada: el ingreso y el IVA del Resumen de IVA quedaban mal.
 */
export class PostNoteJournalEntryUseCase {
  constructor(
    private readonly accountRepo: IChartOfAccountsRepository,
    private readonly createEntry: CreateJournalEntryUseCase,
    private readonly postEntry: PostJournalEntryUseCase
  ) {}

  async execute(input: NoteJournalEntryInput): Promise<JournalEntryRecord | null> {
    const base = round2(input.base);
    const tax = round2(input.tax);
    const total = round2(base + tax);
    if (total <= 0) return null;

    const settlementKey = input.settlement === "CASH" ? "caja" : input.settlement === "TRANSFER" ? "bancos" : "clientes";
    const incomeKey = input.kind === "CREDIT" ? "rebajas" : (DEBIT_INCOME_ACCOUNT[input.conceptCode] ?? "diversos");
    const [counterpart, income, iva] = await Promise.all([
      this.accountRepo.resolvePostingAccount(ACCOUNTS[settlementKey]),
      this.accountRepo.resolvePostingAccount(ACCOUNTS[incomeKey]),
      this.accountRepo.resolvePostingAccount(ACCOUNTS.iva),
    ]);
    const credit = input.kind === "CREDIT";
    const lines = credit
      ? [
          { accountId: income.id, debit: base, credit: 0, description: "Rebaja o descuento en ventas" },
          { accountId: iva.id, debit: tax, credit: 0, description: "Reverso de IVA generado" },
          { accountId: counterpart.id, debit: 0, credit: total, description: "Valor devuelto al cliente" },
        ]
      : [
          { accountId: counterpart.id, debit: total, credit: 0, description: "Cobro adicional al cliente" },
          { accountId: income.id, debit: 0, credit: base, description: "Ingreso por nota debito" },
          { accountId: iva.id, debit: 0, credit: tax, description: "IVA generado" },
        ];

    const entry = await this.createEntry.execute({
      branchId: input.branchId,
      date: input.date,
      description: input.description,
      type: credit ? "CREDIT_NOTE" : "DEBIT_NOTE",
      sourceType: credit ? "CreditNote" : "DebitNote",
      sourceId: input.noteId,
      lines: lines.filter((l) => l.debit > 0 || l.credit > 0),
    });
    return this.postEntry.execute(entry.id);
  }
}
