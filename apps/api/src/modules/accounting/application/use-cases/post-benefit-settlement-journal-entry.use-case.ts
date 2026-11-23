import { round2 } from "@erp/shared-utils";
import type { IChartOfAccountsRepository } from "../../domain/chart-of-accounts.repository";
import type { JournalEntryRecord } from "../../domain/journal-entry.repository";
import { CreateJournalEntryUseCase } from "./create-journal-entry.use-case";
import { PostJournalEntryUseCase } from "./post-journal-entry.use-case";

const ACCOUNTS = {
  provisiones: { code: "2610", name: "Provisiones para obligaciones laborales", type: "LIABILITY" as const },
  recuperacionProvisiones: { code: "5108", name: "Provisiones de prestaciones sociales", type: "EXPENSE" as const },
  salariosPorPagar: { code: "2505", name: "Salarios por pagar", type: "LIABILITY" as const },
  cesantiasConsolidadas: { code: "2510", name: "Cesantias consolidadas", type: "LIABILITY" as const },
  retencionFuente: { code: "236505", name: "Retencion en la fuente - salarios y pagos laborales", type: "LIABILITY" as const },
  gastoCesantias: { code: "510530", name: "Cesantias", type: "EXPENSE" as const },
  gastoIntereses: { code: "510533", name: "Intereses sobre cesantias", type: "EXPENSE" as const },
  gastoPrima: { code: "510536", name: "Prima de servicios", type: "EXPENSE" as const },
  gastoVacaciones: { code: "510539", name: "Vacaciones", type: "EXPENSE" as const },
  gastoIndemnizaciones: { code: "510560", name: "Indemnizaciones laborales", type: "EXPENSE" as const },
};

const EXPENSE_BY_CONCEPT: Record<string, keyof typeof ACCOUNTS> = {
  SEVERANCE: "gastoCesantias",
  SEVERANCE_INTEREST: "gastoIntereses",
  SERVICE_BONUS: "gastoPrima",
  VACATION: "gastoVacaciones",
  INDEMNITY: "gastoIndemnizaciones",
};

export interface BenefitSettlementJournalInput {
  date: Date;
  description: string;
  sourceId: string;
  settlements: {
    lines: { concept: string; amount: number; provisioned: number }[];
    withholding: number;
    netPay: number;
    toSeveranceFund: number;
  }[];
}

/**
 * Comprobante del pago de prestaciones (prima, cesantias, liquidacion del contrato). Usa lo que las
 * nominas mensuales ya habian provisionado en la 2610:
 *   - debito 2610 por TODO lo provisionado del concepto en el periodo (cierra esa provision);
 *   - si lo que se paga es mayor, la diferencia es gasto del concepto (5105xx);
 *   - si lo provisionado era mayor, la diferencia se recupera con un credito a 5108;
 *   - credito 2510 por las cesantias que van al fondo, 236505 por la retencion y 2505 por el neto
 *     que se le paga al trabajador.
 */
export class PostBenefitSettlementJournalEntryUseCase {
  constructor(
    private readonly accountRepo: IChartOfAccountsRepository,
    private readonly createEntry: CreateJournalEntryUseCase,
    private readonly postEntry: PostJournalEntryUseCase
  ) {}

  async execute(input: BenefitSettlementJournalInput): Promise<JournalEntryRecord | null> {
    let provisionsUsed = 0;
    let recovered = 0;
    const expenses: Record<string, number> = {};
    let withholding = 0;
    let netPay = 0;
    let toFund = 0;

    for (const s of input.settlements) {
      for (const line of s.lines) {
        provisionsUsed += line.provisioned;
        const diff = line.amount - line.provisioned;
        if (diff > 0) {
          const key = EXPENSE_BY_CONCEPT[line.concept];
          expenses[key] = (expenses[key] ?? 0) + diff;
        } else {
          recovered += -diff;
        }
      }
      withholding += s.withholding;
      netPay += s.netPay;
      toFund += s.toSeveranceFund;
    }

    const accounts = await this.ensureAccounts();
    const lines = [
      { accountId: accounts.provisiones.id, debit: round2(provisionsUsed), credit: 0, description: "Provision aplicada" },
      ...Object.entries(expenses).map(([key, amount]) => ({
        accountId: accounts[key as keyof typeof ACCOUNTS].id,
        debit: round2(amount),
        credit: 0,
        description: "Mayor valor sobre lo provisionado",
      })),
      { accountId: accounts.recuperacionProvisiones.id, debit: 0, credit: round2(recovered), description: "Provision no usada" },
      { accountId: accounts.cesantiasConsolidadas.id, debit: 0, credit: round2(toFund), description: "Cesantias al fondo" },
      { accountId: accounts.retencionFuente.id, debit: 0, credit: round2(withholding), description: "Retencion en la fuente" },
      { accountId: accounts.salariosPorPagar.id, debit: 0, credit: round2(netPay), description: "Neto a pagar al trabajador" },
    ].filter((l) => l.debit > 0 || l.credit > 0);
    if (lines.length === 0) return null;

    const entry = await this.createEntry.execute({
      date: input.date,
      description: input.description,
      type: "PAYROLL",
      sourceType: "BenefitSettlement",
      sourceId: input.sourceId,
      lines,
    });
    return this.postEntry.execute(entry.id);
  }

  private async ensureAccounts() {
    const entries = await Promise.all(
      Object.entries(ACCOUNTS).map(async ([key, def]) => [key, await this.accountRepo.resolvePostingAccount(def)] as const)
    );
    return Object.fromEntries(entries) as Record<keyof typeof ACCOUNTS, Awaited<ReturnType<IChartOfAccountsRepository["resolvePostingAccount"]>>>;
  }
}
