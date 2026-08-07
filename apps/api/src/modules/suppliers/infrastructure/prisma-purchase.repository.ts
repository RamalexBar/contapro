import { round2 } from "@erp/shared-utils";
import { prisma } from "../../../shared/prisma/prisma-client";
import { getTenantContext } from "../../../shared/context/request-context";
import { NotFoundError } from "../../../shared/errors/app-error";
import type { CreatePurchaseData, IPurchaseRepository, PurchaseRecord } from "../domain/purchase.repository";

type PurchaseRow = {
  id: string;
  branchId: string;
  supplierId: string;
  invoiceNumber: string;
  subtotal: unknown;
  taxTotal: unknown;
  total: unknown;
  retentionTotal: unknown;
  currency: string;
  exchangeRate: unknown;
  status: string;
  createdAt: Date;
  journalEntryId: string | null;
  accountsPayable: { id: string; dueDate: Date }[];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  withholdings: any[];
};

function toRecord(row: PurchaseRow): PurchaseRecord {
  const accountPayable = row.accountsPayable[0];
  return {
    id: row.id,
    branchId: row.branchId,
    supplierId: row.supplierId,
    invoiceNumber: row.invoiceNumber,
    subtotal: Number(row.subtotal),
    taxTotal: Number(row.taxTotal),
    total: Number(row.total),
    retentionTotal: Number(row.retentionTotal),
    currency: row.currency,
    exchangeRate: Number(row.exchangeRate),
    foreignTotal: row.currency === "COP" ? null : round2(Number(row.total) / Number(row.exchangeRate)),
    withholdings: row.withholdings.map((w) => ({
      withholdingConceptId: w.withholdingConceptId,
      type: w.withholdingConcept.type,
      base: Number(w.base),
      ratePercent: Number(w.ratePercent),
      amount: Number(w.amount),
    })),
    status: row.status,
    createdAt: row.createdAt,
    accountPayableId: accountPayable.id,
    dueDate: accountPayable.dueDate,
    journalEntryId: row.journalEntryId,
  };
}

const PURCHASE_INCLUDE = {
  accountsPayable: true,
  withholdings: { include: { withholdingConcept: { select: { type: true } } } },
} as const;

export class PrismaPurchaseRepository implements IPurchaseRepository {
  async create(data: CreatePurchaseData): Promise<PurchaseRecord> {
    const companyId = getTenantContext().companyId;
    // AccountPayable queda NETO de retencion desde su creacion (lo que realmente hay que pagarle
    // al proveedor) -- esto es lo unico que hace falta para que RegisterSupplierPaymentUseCase,
    // PostSupplierPaymentJournalEntryUseCase y CancelPurchaseUseCase sigan funcionando sin
    // ningun cambio: los tres operan solo sobre AccountPayable.balance/.amount, nunca sobre
    // Purchase.total. `Purchase.total` sigue siendo el bruto legal de la factura del proveedor.
    const netTotal = round2(data.total - data.retentionTotal);

    const row = await prisma.$transaction(async (tx) => {
      const purchase = await tx.purchase.create({
        data: {
          companyId,
          branchId: data.branchId,
          supplierId: data.supplierId,
          invoiceNumber: data.invoiceNumber,
          subtotal: data.subtotal,
          taxTotal: data.taxTotal,
          total: data.total,
          retentionTotal: data.retentionTotal,
          currency: data.currency,
          exchangeRate: data.exchangeRate,
          status: "REGISTERED",
          withholdings: {
            create: data.withholdings.map((w) => ({
              withholdingConceptId: w.withholdingConceptId,
              base: w.base,
              ratePercent: w.ratePercent,
              amount: w.amount,
            })),
          },
        },
      });

      await tx.accountPayable.create({
        data: {
          companyId,
          supplierId: data.supplierId,
          purchaseId: purchase.id,
          amount: netTotal,
          balance: netTotal,
          dueDate: data.dueDate,
          status: "PENDING",
        },
      });

      return tx.purchase.findFirstOrThrow({ where: { id: purchase.id }, include: PURCHASE_INCLUDE });
    });

    return toRecord(row);
  }

  async findByIdOrThrow(id: string): Promise<PurchaseRecord> {
    const row = await prisma.purchase.findFirst({ where: { id }, include: PURCHASE_INCLUDE });
    if (!row) throw new NotFoundError("Purchase", id);
    return toRecord(row);
  }

  async list(filters: { take?: number; skip?: number }): Promise<PurchaseRecord[]> {
    const rows = await prisma.purchase.findMany({
      include: PURCHASE_INCLUDE,
      orderBy: { createdAt: "desc" },
      take: filters.take ?? 50,
      skip: filters.skip ?? 0,
    });
    return rows.map(toRecord);
  }

  async listForYear(year: number): Promise<PurchaseRecord[]> {
    const from = new Date(year, 0, 1);
    const to = new Date(year + 1, 0, 1);
    const rows = await prisma.purchase.findMany({
      where: { status: "REGISTERED", createdAt: { gte: from, lt: to } },
      include: PURCHASE_INCLUDE,
      orderBy: { createdAt: "asc" },
    });
    return rows.map(toRecord);
  }

  async setJournalEntryId(id: string, journalEntryId: string): Promise<void> {
    // findFirst (via findByIdOrThrow) queda auto-scopeado por tenant.extension.ts; el update por
    // id que sigue no -- se confirma pertenencia al tenant primero.
    await this.findByIdOrThrow(id);
    await prisma.purchase.update({ where: { id }, data: { journalEntryId } });
  }

  async cancel(id: string): Promise<PurchaseRecord> {
    await this.findByIdOrThrow(id);
    const row = await prisma.$transaction(async (tx) => {
      const purchase = await tx.purchase.update({ where: { id }, data: { status: "CANCELLED" } });
      await tx.accountPayable.updateMany({ where: { purchaseId: id }, data: { status: "CANCELLED" } });
      return tx.purchase.findFirstOrThrow({ where: { id: purchase.id }, include: PURCHASE_INCLUDE });
    });
    return toRecord(row);
  }
}
