import { round2 } from "@erp/shared-utils";
import type { IChartOfAccountsRepository } from "../../domain/chart-of-accounts.repository";
import type { JournalEntryRecord } from "../../domain/journal-entry.repository";
import { CreateJournalEntryUseCase } from "./create-journal-entry.use-case";
import { PostJournalEntryUseCase } from "./post-journal-entry.use-case";

const STANDARD_ACCOUNTS = {
  caja: { code: "1105", name: "Caja general", type: "ASSET" as const },
  bancos: { code: "1110", name: "Bancos", type: "ASSET" as const },
  // Servicios de software: el PUC agrupa las actividades de informatica en 4155 (actividades
  // empresariales). Propuesta pendiente de revisar con el contador, igual que la clasificacion NIIF.
  ingresosServicios: { code: "4155", name: "Actividades empresariales de consultoria e informatica", type: "INCOME" as const },
};

export interface ServiceIncomeJournalEntryInput {
  branchId: string;
  date: Date;
  description: string;
  /** Valor cobrado, sin IVA (el emisor es no responsable de IVA). */
  amount: number;
  /** CASH = Caja; cualquier otro (WOMPI, WOMPI_AUTO, TRANSFER...) = Bancos. */
  paymentMethod: string;
  sourceType: string;
  sourceId: string;
}

/**
 * Contabiliza un ingreso por servicios ya cobrado: debito Caja o Bancos, credito Ingresos por
 * servicios (4155). Lo usa la factura de la suscripcion de Contapro (modules/saas-admin, ver
 * InvoiceSubscriptionPaymentUseCase), que es una factura manual y por si sola no contabiliza. La
 * comision de la pasarela (Wompi) no se registra aqui: llega neta al banco y se reconoce como gasto
 * al conciliar. Las cuentas se resuelven como en el resto de Post*JournalEntryUseCase (resolvePostingAccount).
 */
export class PostServiceIncomeJournalEntryUseCase {
  constructor(
    private readonly accountRepo: IChartOfAccountsRepository,
    private readonly createEntry: CreateJournalEntryUseCase,
    private readonly postEntry: PostJournalEntryUseCase
  ) {}

  async execute(input: ServiceIncomeJournalEntryInput): Promise<JournalEntryRecord | null> {
    const amount = round2(input.amount);
    if (amount <= 0) return null;

    const [caja, bancos, ingresos] = await Promise.all([
      this.accountRepo.resolvePostingAccount(STANDARD_ACCOUNTS.caja),
      this.accountRepo.resolvePostingAccount(STANDARD_ACCOUNTS.bancos),
      this.accountRepo.resolvePostingAccount(STANDARD_ACCOUNTS.ingresosServicios),
    ]);
    const received = input.paymentMethod === "CASH" ? caja : bancos;

    const entry = await this.createEntry.execute({
      branchId: input.branchId,
      date: input.date,
      description: input.description,
      type: "SALE",
      sourceType: input.sourceType,
      sourceId: input.sourceId,
      lines: [
        { accountId: received.id, debit: amount, credit: 0, description: input.paymentMethod === "CASH" ? "Efectivo" : "Recaudo en bancos" },
        { accountId: ingresos.id, debit: 0, credit: amount, description: "Ingreso por servicios" },
      ],
    });

    return this.postEntry.execute(entry.id);
  }
}
