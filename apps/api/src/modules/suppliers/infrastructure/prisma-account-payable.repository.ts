import { getTenantContext } from "../../../shared/context/request-context";
import { prisma } from "../../../shared/prisma/prisma-client";
import { NotFoundError, ValidationError } from "../../../shared/errors/app-error";
import type { PaymentHistoryFilter, PaymentHistoryRow } from "../domain/account-payable.repository";
import type {
  AccountPayableRecord,
  IAccountPayableRepository,
  RegisterPaymentResult,
  ReversePaymentsResult,
  SupplierPaymentRecord,
} from "../domain/account-payable.repository";

type AccountPayableRow = {
  id: string;
  supplierId: string;
  purchaseId: string;
  purchase: { branchId: string; invoiceNumber: string };
  amount: unknown;
  balance: unknown;
  dueDate: Date;
  status: string;
};

function toRecord(row: AccountPayableRow): AccountPayableRecord {
  return {
    id: row.id,
    supplierId: row.supplierId,
    purchaseId: row.purchaseId,
    branchId: row.purchase.branchId,
    documentLabel: `Factura ${row.purchase.invoiceNumber}`,
    amount: Number(row.amount),
    balance: Number(row.balance),
    dueDate: row.dueDate,
    status: row.status,
  };
}

const INCLUDE = { purchase: { select: { branchId: true, invoiceNumber: true } } } as const;

function toPaymentRecord(row: {
  id: string;
  accountPayableId: string;
  amount: unknown;
  method: string;
  status: string;
  paidAt: Date;
}): SupplierPaymentRecord {
  return {
    id: row.id,
    accountPayableId: row.accountPayableId,
    amount: Number(row.amount),
    method: row.method,
    status: row.status as "REGISTERED" | "REVERSED",
    paidAt: row.paidAt,
  };
}

export class PrismaAccountPayableRepository implements IAccountPayableRepository {
  async list(filter?: { status?: string }): Promise<AccountPayableRecord[]> {
    const rows = await prisma.accountPayable.findMany({
      where: filter?.status ? { status: filter.status } : undefined,
      include: INCLUDE,
      orderBy: { dueDate: "asc" },
    });
    return rows.map(toRecord);
  }

  async listActive(): Promise<AccountPayableRecord[]> {
    const rows = await prisma.accountPayable.findMany({
      where: { status: { in: ["PENDING", "PARTIAL", "OVERDUE"] } },
      include: INCLUDE,
    });
    return rows.map(toRecord);
  }

  async findByIdOrThrow(id: string): Promise<AccountPayableRecord> {
    const row = await prisma.accountPayable.findFirst({ where: { id }, include: INCLUDE });
    if (!row) throw new NotFoundError("AccountPayable", id);
    return toRecord(row);
  }

  async findPaymentByIdOrThrow(id: string): Promise<SupplierPaymentRecord> {
    const row = await prisma.supplierPayment.findFirst({ where: { id } });
    if (!row) throw new NotFoundError("SupplierPayment", id);
    return toPaymentRecord(row);
  }

  async registerPayment(accountPayableId: string, amount: number, method: string, userId: string): Promise<RegisterPaymentResult> {
    return prisma.$transaction(async (tx) => {
      const current = await tx.accountPayable.findFirst({ where: { id: accountPayableId }, include: INCLUDE });
      if (!current) throw new NotFoundError("AccountPayable", accountPayableId);
      if (current.status === "CANCELLED") {
        throw new ValidationError("Esta cuenta por pagar fue cancelada, no admite abonos");
      }

      const balance = Number(current.balance);
      if (amount > balance) {
        throw new ValidationError(`El abono (${amount}) no puede superar el saldo pendiente (${balance})`);
      }

      const newBalance = Math.round((balance - amount) * 100) / 100;
      const newStatus = newBalance === 0 ? "PAID" : "PARTIAL";

      const updated = await tx.accountPayable.update({
        where: { id: accountPayableId },
        data: { balance: newBalance, status: newStatus },
        include: INCLUDE,
      });

      const payment = await tx.supplierPayment.create({
        data: { accountPayableId, amount, method, createdByUserId: userId },
      });

      return {
        payment: toPaymentRecord(payment),
        accountPayable: toRecord(updated),
      };
    });
  }

  async reverseAllPayments(accountPayableId: string): Promise<ReversePaymentsResult> {
    return prisma.$transaction(async (tx) => {
      const current = await tx.accountPayable.findFirst({ where: { id: accountPayableId }, include: INCLUDE });
      if (!current) throw new NotFoundError("AccountPayable", accountPayableId);

      const activePayments = await tx.supplierPayment.findMany({
        where: { accountPayableId, status: "REGISTERED" },
      });
      if (activePayments.length === 0) {
        return { accountPayable: toRecord(current), reversedPayments: [] };
      }

      await tx.supplierPayment.updateMany({
        where: { id: { in: activePayments.map((p) => p.id) } },
        data: { status: "REVERSED" },
      });

      const updated = await tx.accountPayable.update({
        where: { id: accountPayableId },
        data: { balance: current.amount, status: "PENDING" },
        include: INCLUDE,
      });

      return {
        accountPayable: toRecord(updated),
        reversedPayments: activePayments.map((p) => toPaymentRecord({ ...p, status: "REVERSED" })),
      };
    });
  }

  async listPayments(filter: PaymentHistoryFilter): Promise<PaymentHistoryRow[]> {
    const rows = await prisma.supplierPayment.findMany({
      where: {
        paidAt: { gte: filter.from, lte: filter.to },
        accountPayable: { companyId: getTenantContext().companyId, supplierId: filter.supplierId },
      },
      include: { accountPayable: { select: { supplierId: true, purchase: { select: { invoiceNumber: true } } } } },
      orderBy: { paidAt: "desc" },
      take: 300,
    });
    const supplierIds = [...new Set(rows.map((r) => r.accountPayable.supplierId))];
    const suppliers = supplierIds.length
      ? await prisma.supplier.findMany({ where: { id: { in: supplierIds } }, select: { id: true, name: true, documentType: true, nit: true } })
      : [];
    const byId = new Map(suppliers.map((s) => [s.id, s]));
    return rows.map((r) => {
      const s = byId.get(r.accountPayable.supplierId);
      return {
        id: r.id,
        paidAt: r.paidAt,
        amount: Number(r.amount),
        method: r.method,
        status: r.status,
        supplierName: s?.name ?? "-",
        supplierDocument: s ? `${s.documentType} ${s.nit}` : "",
        documentLabel: `Factura ${r.accountPayable.purchase.invoiceNumber}`,
      };
    });
  }
}
