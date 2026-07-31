import { prisma } from "../../../shared/prisma/prisma-client";
import { NotFoundError, ValidationError } from "../../../shared/errors/app-error";
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
  purchase: { branchId: string };
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
    amount: Number(row.amount),
    balance: Number(row.balance),
    dueDate: row.dueDate,
    status: row.status,
  };
}

const INCLUDE = { purchase: { select: { branchId: true } } } as const;

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

  async findByIdOrThrow(id: string): Promise<AccountPayableRecord> {
    const row = await prisma.accountPayable.findFirst({ where: { id }, include: INCLUDE });
    if (!row) throw new NotFoundError("AccountPayable", id);
    return toRecord(row);
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
}
