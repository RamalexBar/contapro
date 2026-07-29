import { round2 } from "@erp/shared-utils";
import type { IChartOfAccountsRepository } from "../../domain/chart-of-accounts.repository";
import type { IJournalEntryRepository, JournalEntryRecord } from "../../domain/journal-entry.repository";
import { CreateJournalEntryUseCase } from "./create-journal-entry.use-case";
import { PostJournalEntryUseCase } from "./post-journal-entry.use-case";

const EMPLOYER_CONTRIBUTION_CODES = new Set(["HEALTH_EMPLOYER", "PENSION_EMPLOYER", "ARL", "CCF", "ICBF", "SENA"]);
const PROVISION_CODES = new Set(["SEVERANCE", "SEVERANCE_INTEREST", "SERVICE_BONUS", "VACATION"]);

const STANDARD_ACCOUNTS = {
  devengado: { code: "5105", name: "Gastos de personal - sueldos", type: "EXPENSE" as const },
  aportesPatronalesGasto: { code: "5107", name: "Aportes sobre la nomina", type: "EXPENSE" as const },
  provisionesGasto: { code: "5108", name: "Provisiones de prestaciones sociales", type: "EXPENSE" as const },
  salariosPorPagar: { code: "2505", name: "Salarios por pagar", type: "LIABILITY" as const },
  retencionesNomina: { code: "2370", name: "Retenciones y aportes de nomina por pagar", type: "LIABILITY" as const },
  aportesPatronalesPasivo: { code: "2380", name: "Aportes patronales por pagar", type: "LIABILITY" as const },
  provisionesPasivo: { code: "2610", name: "Provisiones para obligaciones laborales", type: "LIABILITY" as const },
};

export interface PayrollJournalEntryInput {
  payrollId: string;
  year: number;
  month: number;
  endDate: Date;
  details: {
    grossTotal: number;
    netPay: number;
    totalDeductions: number;
    items: { conceptCode: string; amount: number }[];
  }[];
}

/**
 * Genera y contabiliza automaticamente el comprobante de nomina al aprobar un periodo (ver
 * docs/ALCANCE.md, item pendiente de la iteracion 2). Las 7 cuentas estandar se crean solas la
 * primera vez que se usan (upsertByCode) para no exigir configuracion manual previa del plan de
 * cuentas.
 *
 * Partida doble: debito devengado + aportes patronales + provisiones = credito neto a pagar +
 * deducciones de empleado + aportes patronales por pagar + provisiones por pagar (ambos lados
 * suman el `employerCostTotal` del periodo).
 */
export class PostPayrollJournalEntryUseCase {
  constructor(
    private readonly accountRepo: IChartOfAccountsRepository,
    private readonly createEntry: CreateJournalEntryUseCase,
    private readonly postEntry: PostJournalEntryUseCase
  ) {}

  async execute(input: PayrollJournalEntryInput): Promise<JournalEntryRecord | null> {
    if (input.details.length === 0) return null;

    let devengado = 0;
    let aportesPatronales = 0;
    let provisiones = 0;
    let netPay = 0;
    let deduccionesEmpleado = 0;

    for (const detail of input.details) {
      devengado += detail.grossTotal;
      netPay += detail.netPay;
      deduccionesEmpleado += detail.totalDeductions;
      for (const item of detail.items) {
        if (EMPLOYER_CONTRIBUTION_CODES.has(item.conceptCode)) aportesPatronales += item.amount;
        if (PROVISION_CODES.has(item.conceptCode)) provisiones += item.amount;
      }
    }
    devengado = round2(devengado);
    aportesPatronales = round2(aportesPatronales);
    provisiones = round2(provisiones);
    netPay = round2(netPay);
    deduccionesEmpleado = round2(deduccionesEmpleado);

    const accounts = await this.ensureAccounts();

    const entry = await this.createEntry.execute({
      date: input.endDate,
      description: `Nomina ${input.month}/${input.year}`,
      type: "PAYROLL",
      sourceType: "Payroll",
      sourceId: input.payrollId,
      lines: [
        { accountId: accounts.devengado.id, debit: devengado, credit: 0, description: "Devengado" },
        {
          accountId: accounts.aportesPatronalesGasto.id,
          debit: aportesPatronales,
          credit: 0,
          description: "Aportes patronales",
        },
        { accountId: accounts.provisionesGasto.id, debit: provisiones, credit: 0, description: "Provisiones" },
        { accountId: accounts.salariosPorPagar.id, debit: 0, credit: netPay, description: "Neto a pagar" },
        {
          accountId: accounts.retencionesNomina.id,
          debit: 0,
          credit: deduccionesEmpleado,
          description: "Deducciones de empleado",
        },
        {
          accountId: accounts.aportesPatronalesPasivo.id,
          debit: 0,
          credit: aportesPatronales,
          description: "Aportes patronales por pagar",
        },
        {
          accountId: accounts.provisionesPasivo.id,
          debit: 0,
          credit: provisiones,
          description: "Provisiones por pagar",
        },
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
