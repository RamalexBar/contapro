import { round2 } from "@erp/shared-utils";
import type { IChartOfAccountsRepository } from "../../domain/chart-of-accounts.repository";
import type { IJournalEntryRepository } from "../../domain/journal-entry.repository";
import type { IVatActivityReader, TaxRateRow } from "../../domain/vat-activity.reader";

/** Cuenta donde todo el sistema netea el IVA generado (credito) y el descontable (debito). */
export const VAT_ACCOUNT_CODE = "2408";
/** Impuesto al consumo (restaurantes/bares): se declara aparte, en el formulario 310. */
export const CONSUMPTION_TAX_ACCOUNT_CODE = "240810";

const ORIGIN_LABELS: Record<string, string> = {
  Sale: "Ventas del punto de venta",
  ExternalShiftClose: "Cierres de caja (Cajapro u otro POS)",
  Return: "Devoluciones en ventas",
  Purchase: "Compras a proveedores",
  Expense: "Gastos",
  MANUAL: "Comprobantes manuales",
};

export interface VatOriginRow {
  origin: string;
  label: string;
  /** Creditos a 2408: IVA cobrado en ventas. */
  generated: number;
  /** Debitos a 2408: IVA pagado en compras y gastos, o reversado por devoluciones. */
  deductible: number;
}

export interface VatRateRow {
  taxType: string;
  taxRate: number;
  salesBase: number;
  salesTax: number;
  returnsBase: number;
  returnsTax: number;
}

export interface VatSummary {
  from: string;
  to: string;
  generated: number;
  deductible: number;
  /** generated - deductible: positivo = a pagar a la DIAN, negativo = saldo a favor. */
  balance: number;
  byOrigin: VatOriginRow[];
  byRate: VatRateRow[];
  shiftClosesWithoutDetail: number;
  /** Saldo del impuesto al consumo del periodo (informativo, no entra en el IVA). */
  consumptionTax: number;
}

const rateKey = (r: { taxType: string; taxRate: number }) => `${r.taxType}:${r.taxRate}`;

/**
 * Resumen de IVA de un periodo (bimestre o cuatrimestre), para llenar el formulario 300. Los
 * totales salen del libro mayor de la cuenta 2408 -- lo mismo que muestra el Balance --, y el
 * desglose por tarifa de los documentos de venta. Es una guia para el contador, no la declaracion.
 */
export class GetVatSummaryUseCase {
  constructor(
    private readonly journalRepo: IJournalEntryRepository,
    private readonly accountRepo: IChartOfAccountsRepository,
    private readonly activityReader: IVatActivityReader
  ) {}

  async execute(from: Date, to: Date, branchId?: string): Promise<VatSummary> {
    const accounts = await this.accountRepo.list();
    const vatAccount = accounts.find((a) => a.code === VAT_ACCOUNT_CODE);
    const incAccount = accounts.find((a) => a.code === CONSUMPTION_TAX_ACCOUNT_CODE);

    const byOrigin = new Map<string, VatOriginRow>();
    if (vatAccount) {
      for (const line of await this.journalRepo.listPostedLines({ from, to, accountId: vatAccount.id, branchId })) {
        const origin = line.sourceType ?? "MANUAL";
        const row = byOrigin.get(origin) ?? { origin, label: ORIGIN_LABELS[origin] ?? origin, generated: 0, deductible: 0 };
        row.generated += line.credit;
        row.deductible += line.debit;
        byOrigin.set(origin, row);
      }
    }
    const origins = [...byOrigin.values()].map((r) => ({ ...r, generated: round2(r.generated), deductible: round2(r.deductible) }));
    const generated = round2(origins.reduce((s, r) => s + r.generated, 0));
    const deductible = round2(origins.reduce((s, r) => s + r.deductible, 0));

    let consumptionTax = 0;
    if (incAccount) {
      for (const line of await this.journalRepo.listPostedLines({ from, to, accountId: incAccount.id, branchId })) {
        consumptionTax += line.credit - line.debit;
      }
    }

    const activity = await this.activityReader.getTaxableActivity(from, to, branchId);
    const byRate = new Map<string, VatRateRow>();
    const rowFor = (r: TaxRateRow) => {
      const key = rateKey(r);
      const row = byRate.get(key) ?? { taxType: r.taxType, taxRate: r.taxRate, salesBase: 0, salesTax: 0, returnsBase: 0, returnsTax: 0 };
      byRate.set(key, row);
      return row;
    };
    for (const s of activity.sales) {
      const row = rowFor(s);
      row.salesBase += s.taxableBase;
      row.salesTax += s.taxAmount;
    }
    for (const r of activity.returns) {
      const row = rowFor(r);
      row.returnsBase += r.taxableBase;
      row.returnsTax += r.taxAmount;
    }
    const typeOrder = ["IVA", "INC", "EXEMPT", "EXCLUDED"];
    const rates = [...byRate.values()]
      .map((r) => ({ ...r, salesBase: round2(r.salesBase), salesTax: round2(r.salesTax), returnsBase: round2(r.returnsBase), returnsTax: round2(r.returnsTax) }))
      .sort((a, b) => typeOrder.indexOf(a.taxType) - typeOrder.indexOf(b.taxType) || b.taxRate - a.taxRate);

    return {
      from: from.toISOString(),
      to: to.toISOString(),
      generated,
      deductible,
      balance: round2(generated - deductible),
      byOrigin: origins.sort((a, b) => b.generated - a.generated || b.deductible - a.deductible),
      byRate: rates,
      shiftClosesWithoutDetail: activity.shiftClosesWithoutDetail,
      consumptionTax: round2(consumptionTax),
    };
  }
}
