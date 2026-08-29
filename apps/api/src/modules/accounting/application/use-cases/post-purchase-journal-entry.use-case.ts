import { round2 } from "@erp/shared-utils";
import type { IChartOfAccountsRepository } from "../../domain/chart-of-accounts.repository";
import type { JournalEntryRecord } from "../../domain/journal-entry.repository";
import type { WithholdingType } from "../../domain/withholding-concept.repository";
import { CreateJournalEntryUseCase } from "./create-journal-entry.use-case";
import { PostJournalEntryUseCase } from "./post-journal-entry.use-case";

const STANDARD_ACCOUNTS = {
  inventario: { code: "1435", name: "Inventarios - mercancias no fabricadas por la empresa", type: "ASSET" as const },
  // Misma cuenta que usa PostSaleJournalEntryUseCase para el IVA generado: el PUC colombiano
  // netea IVA generado (credito) e IVA descontable (debito) en la cuenta 2408.
  ivaPorPagar: { code: "2408", name: "Impuesto sobre las ventas por pagar", type: "LIABILITY" as const },
  proveedores: { code: "2205", name: "Proveedores nacionales", type: "LIABILITY" as const },
  // Retenciones que la EMPRESA (compradora) le practica a este proveedor: a diferencia de
  // ventas, aqui Contapro es quien retiene, por eso son PASIVO (plata que debe declarar/pagar a
  // la DIAN), no activo como en post-sale-journal-entry.use-case.ts. Una cuenta fija por tipo,
  // nunca por concepto -- mismo criterio que 2408 para IVA sin importar la tarifa.
  retefuentePorPagar: { code: "236540", name: "Retencion en la fuente por pagar", type: "LIABILITY" as const },
  reteicaPorPagar: { code: "236801", name: "Retencion de ICA por pagar", type: "LIABILITY" as const },
  reteivaPorPagar: { code: "236705", name: "Retencion de IVA por pagar", type: "LIABILITY" as const },
};

const WITHHOLDING_ACCOUNT_KEY: Record<WithholdingType, "retefuentePorPagar" | "reteicaPorPagar" | "reteivaPorPagar"> = {
  RETEFUENTE: "retefuentePorPagar",
  RETEICA: "reteicaPorPagar",
  RETEIVA: "reteivaPorPagar",
};

export interface PurchaseJournalEntryInput {
  purchaseId: string;
  branchId: string;
  date: Date;
  invoiceNumber: string;
  subtotal: number;
  taxTotal: number;
  total: number;
  retentionTotal: number;
  withholdingsByType: Record<WithholdingType, number>;
  // Multi-moneda informativa (item 33 de docs/ALCANCE.md) -- ver post-sale-journal-entry.use-case.ts.
  currency?: string;
  exchangeRate?: number;
}

/**
 * Contabiliza una compra registrada: debito Inventario (base) + IVA descontable, credito
 * Proveedores nacionales por el NETO de retencion (lo que realmente se le debe al proveedor,
 * ver PrismaPurchaseRepository) + las retenciones practicadas (pasivo a favor de la DIAN, ver
 * STANDARD_ACCOUNTS arriba). `total` sigue siendo el bruto legal de la factura del proveedor.
 * Las cuentas estandar se crean solas la primera vez (upsertByCode).
 */
export class PostPurchaseJournalEntryUseCase {
  constructor(
    private readonly accountRepo: IChartOfAccountsRepository,
    private readonly createEntry: CreateJournalEntryUseCase,
    private readonly postEntry: PostJournalEntryUseCase
  ) {}

  async execute(input: PurchaseJournalEntryInput): Promise<JournalEntryRecord | null> {
    if (input.total === 0) return null;

    const accounts = await this.ensureAccounts();
    const netTotal = round2(input.total - input.retentionTotal);

    const withholdingLines = (Object.entries(input.withholdingsByType) as [WithholdingType, number][]).map(
      ([type, amount]) => ({
        accountId: accounts[WITHHOLDING_ACCOUNT_KEY[type]].id,
        debit: 0,
        credit: round2(amount),
        description: `Retencion practicada al proveedor (${type})`,
      })
    );

    const currency = input.currency ?? "COP";
    const exchangeRate = input.exchangeRate ?? 1;
    const description =
      currency === "COP"
        ? `Compra factura ${input.invoiceNumber}`
        : `Compra factura ${input.invoiceNumber} (${currency} ${round2(input.total / exchangeRate)} @ TRM ${exchangeRate})`;

    const entry = await this.createEntry.execute({
      branchId: input.branchId,
      date: input.date,
      description,
      type: "PURCHASE",
      sourceType: "Purchase",
      sourceId: input.purchaseId,
      lines: [
        { accountId: accounts.inventario.id, debit: input.subtotal, credit: 0, description: "Inventario" },
        { accountId: accounts.ivaPorPagar.id, debit: input.taxTotal, credit: 0, description: "IVA descontable" },
        { accountId: accounts.proveedores.id, debit: 0, credit: netTotal, description: "Cuenta por pagar" },
        ...withholdingLines,
      ].filter((line) => line.debit > 0 || line.credit > 0),
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
