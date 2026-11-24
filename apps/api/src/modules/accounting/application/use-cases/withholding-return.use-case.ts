import { round2 } from "@erp/shared-utils";
import { ConflictError, ValidationError } from "../../../../shared/errors/app-error";
import type { AuditService } from "../../../audit/application/audit.service";
import type { IChartOfAccountsRepository } from "../../domain/chart-of-accounts.repository";
import type { IJournalEntryRepository, JournalEntryRecord } from "../../domain/journal-entry.repository";
import type { IWithholdingReportReader, PracticedWithholding } from "../../domain/withholding-report.reader";
import type { CreateJournalEntryUseCase } from "./create-journal-entry.use-case";
import type { PostJournalEntryUseCase } from "./post-journal-entry.use-case";

export const WITHHOLDING_RETURN_SOURCE = "WithholdingReturn350";

/** Renglones del formulario 350 que Contapro puede llenar (los demas quedan en cero). */
export type Return350Line =
  | "RENTAS_TRABAJO"
  | "HONORARIOS"
  | "SERVICIOS"
  | "ARRENDAMIENTOS"
  | "COMPRAS"
  | "OTROS_PAGOS"
  | "RETEIVA_RESPONSABLES";

const LINE_LABEL: Record<Return350Line, string> = {
  RENTAS_TRABAJO: "Rentas de trabajo (salarios y pagos laborales)",
  HONORARIOS: "Honorarios",
  SERVICIOS: "Servicios",
  ARRENDAMIENTOS: "Arrendamientos",
  COMPRAS: "Compras",
  OTROS_PAGOS: "Otros pagos sujetos a retencion",
  RETEIVA_RESPONSABLES: "Retencion de IVA a responsables del IVA",
};

const LINE_BY_CONCEPT: Record<string, Return350Line> = {
  "RF-COMPRAS": "COMPRAS",
  "RF-SERVICIOS": "SERVICIOS",
  "RF-HONORARIOS": "HONORARIOS",
  "RF-ARRENDAMIENTOS": "ARRENDAMIENTOS",
};

/** Cuentas por pagar de cada origen (las mismas que usan los comprobantes de compra y de nomina). */
const ACCOUNTS = {
  retefuenteCompras: { code: "236540", name: "Retencion en la fuente por pagar", type: "LIABILITY" as const },
  retefuenteSalarios: { code: "236505", name: "Retencion en la fuente - salarios y pagos laborales", type: "LIABILITY" as const },
  reteiva: { code: "236705", name: "Retencion de IVA por pagar", type: "LIABILITY" as const },
  caja: { code: "1105", name: "Caja general", type: "ASSET" as const },
  bancos: { code: "1110", name: "Bancos", type: "ASSET" as const },
  // Ajuste al peso: el 350 se paga redondeado a miles.
  ajusteGasto: { code: "5395", name: "Gastos diversos - ajuste al peso", type: "EXPENSE" as const },
  ajusteIngreso: { code: "4295", name: "Diversos (otros ingresos)", type: "INCOME" as const },
};

export interface Return350Row {
  line: Return350Line;
  label: string;
  base: number;
  amount: number;
  count: number;
}

export interface Return350 {
  year: number;
  month: number;
  rows: Return350Row[];
  totalRetefuente: number;
  totalReteiva: number;
  /** Total a pagar en el 350 (renta + IVA). */
  totalToPay: number;
  /** ReteICA practicada: no va en el 350 (se declara al municipio), se muestra aparte. */
  reteicaInformative: number;
  /** Comprobante del pago, si ya se registro. */
  paymentEntryNumber: number | null;
  /** Por cuenta: lo que sale de cada pasivo al pagar. */
  byAccount: { retefuenteCompras: number; retefuenteSalarios: number; reteiva: number };
}

/** Agrupa las retenciones del mes en los renglones del formulario 350. Funcion pura. */
export function buildReturn350(year: number, month: number, withholdings: PracticedWithholding[]): Omit<Return350, "paymentEntryNumber"> {
  const rows = new Map<Return350Line, Return350Row>();
  let reteica = 0;
  const byAccount = { retefuenteCompras: 0, retefuenteSalarios: 0, reteiva: 0 };
  for (const w of withholdings) {
    if (w.amount <= 0) continue;
    if (w.type === "RETEICA") {
      reteica = round2(reteica + w.amount);
      continue;
    }
    const line: Return350Line =
      w.type === "RETEIVA" ? "RETEIVA_RESPONSABLES" : w.source !== "PURCHASE" ? "RENTAS_TRABAJO" : (LINE_BY_CONCEPT[w.conceptCode ?? ""] ?? "OTROS_PAGOS");
    const row = rows.get(line) ?? { line, label: LINE_LABEL[line], base: 0, amount: 0, count: 0 };
    row.base = round2(row.base + w.base);
    row.amount = round2(row.amount + w.amount);
    row.count++;
    rows.set(line, row);
    if (w.type === "RETEIVA") byAccount.reteiva = round2(byAccount.reteiva + w.amount);
    else if (w.source === "PURCHASE") byAccount.retefuenteCompras = round2(byAccount.retefuenteCompras + w.amount);
    else byAccount.retefuenteSalarios = round2(byAccount.retefuenteSalarios + w.amount);
  }
  const order = Object.keys(LINE_LABEL) as Return350Line[];
  const sorted = [...rows.values()].sort((a, b) => order.indexOf(a.line) - order.indexOf(b.line));
  const totalReteiva = rows.get("RETEIVA_RESPONSABLES")?.amount ?? 0;
  const totalRetefuente = round2(sorted.filter((r) => r.line !== "RETEIVA_RESPONSABLES").reduce((s, r) => s + r.amount, 0));
  // La DIAN recibe los valores del 350 redondeados al multiplo de 1.000 mas cercano (art. 868 E.T.).
  const totalToPay = Math.round((totalRetefuente + totalReteiva) / 1000) * 1000;
  return { year, month, rows: sorted, totalRetefuente, totalReteiva, totalToPay, reteicaInformative: reteica, byAccount };
}

/**
 * Formulario 350 (declaracion mensual de retenciones en la fuente): resumen por renglon de lo que la
 * empresa retuvo en el mes (compras, nomina y prestaciones) y registro del pago, que deja en cero las
 * retenciones por pagar del mes. Antes las cuentas 236540/236505/236705 solo acumulaban saldo.
 * Es una guia para diligenciar el formulario en el portal de la DIAN, no la declaracion: no incluye
 * autorretenciones ni retenciones asumidas.
 */
export class WithholdingReturnUseCase {
  constructor(
    private readonly reader: IWithholdingReportReader,
    private readonly accountRepo: IChartOfAccountsRepository,
    private readonly journalRepo: IJournalEntryRepository,
    private readonly createEntry: CreateJournalEntryUseCase,
    private readonly postEntry: PostJournalEntryUseCase,
    private readonly audit: AuditService
  ) {}

  async report(year: number, month: number): Promise<Return350> {
    if (!Number.isInteger(month) || month < 1 || month > 12 || !Number.isInteger(year)) throw new ValidationError("Periodo invalido");
    const built = buildReturn350(year, month, await this.reader.listForMonth(year, month));
    const payment = await this.existingPayment(year, month);
    return { ...built, paymentEntryNumber: payment?.number ?? null };
  }

  /** Registra el pago: Debito a cada retencion por pagar, Credito a bancos o caja, con fecha de pago. */
  async registerPayment(year: number, month: number, paidFrom: "BANK" | "CASH", paymentDate: Date): Promise<JournalEntryRecord> {
    const report = await this.report(year, month);
    if (report.paymentEntryNumber) throw new ConflictError(`El pago de ${month}/${year} ya esta registrado (comprobante #${report.paymentEntryNumber})`);
    const total = round2(report.byAccount.retefuenteCompras + report.byAccount.retefuenteSalarios + report.byAccount.reteiva);
    if (total <= 0) throw new ValidationError(`No hay retenciones practicadas en ${month}/${year}`);

    const rounding = round2(report.totalToPay - total);
    const [compras, salarios, reteiva, payFrom, adjustment] = await Promise.all([
      this.accountRepo.resolvePostingAccount(ACCOUNTS.retefuenteCompras),
      this.accountRepo.resolvePostingAccount(ACCOUNTS.retefuenteSalarios),
      this.accountRepo.resolvePostingAccount(ACCOUNTS.reteiva),
      this.accountRepo.resolvePostingAccount(paidFrom === "BANK" ? ACCOUNTS.bancos : ACCOUNTS.caja),
      this.accountRepo.resolvePostingAccount(rounding >= 0 ? ACCOUNTS.ajusteGasto : ACCOUNTS.ajusteIngreso),
    ]);
    const entry = await this.createEntry.execute({
      date: paymentDate,
      description: `Pago formulario 350 - retenciones de ${month}/${year}`,
      type: "TAX_PAYMENT",
      sourceType: WITHHOLDING_RETURN_SOURCE,
      sourceId: `${year}-${String(month).padStart(2, "0")}`,
      lines: [
        { accountId: compras.id, debit: report.byAccount.retefuenteCompras, credit: 0, description: "Retenciones practicadas en compras" },
        { accountId: salarios.id, debit: report.byAccount.retefuenteSalarios, credit: 0, description: "Retenciones por rentas de trabajo" },
        { accountId: reteiva.id, debit: report.byAccount.reteiva, credit: 0, description: "Retenciones de IVA" },
        { accountId: adjustment.id, debit: rounding > 0 ? rounding : 0, credit: rounding < 0 ? -rounding : 0, description: "Ajuste al peso (valores del 350 redondeados a miles)" },
        { accountId: payFrom.id, debit: 0, credit: report.totalToPay, description: "Pago a la DIAN (formulario 350)" },
      ].filter((l) => l.debit > 0 || l.credit > 0),
    });
    const posted = await this.postEntry.execute(entry.id);
    await this.audit.record({
      action: "WITHHOLDING_PAYMENT_POSTED",
      entityType: "JournalEntry",
      entityId: posted.id,
      description: `Pago formulario 350 de ${month}/${year} por ${report.totalToPay} (comprobante #${posted.number})`,
      metadata: { year, month, total: report.totalToPay, rounding },
    });
    return posted;
  }

  private async existingPayment(year: number, month: number): Promise<JournalEntryRecord | null> {
    const entry = await this.journalRepo.findBySource(WITHHOLDING_RETURN_SOURCE, `${year}-${String(month).padStart(2, "0")}`);
    return entry && entry.status !== "VOID" ? entry : null;
  }
}
