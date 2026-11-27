import { basePrisma } from "@erp/database";
import { prisma } from "../../../shared/prisma/prisma-client";
import { getTenantContext } from "../../../shared/context/request-context";
import { NotFoundError, ValidationError } from "../../../shared/errors/app-error";
import type { PaymentHistoryFilter, PaymentHistoryRow } from "../domain/account-receivable.repository";
import type {
  AccountReceivablePaymentRecord,
  AccountReceivableRecord,
  CreateAccountReceivableData,
  IAccountReceivableRepository,
  ReceivablePaymentWithCompany,
  RegisterReceivablePaymentResult,
} from "../domain/account-receivable.repository";

const INCLUDE = {
  sale: { select: { branchId: true, number: true } },
  manualInvoice: { select: { branchId: true, electronicInvoice: { select: { fullNumber: true } } } },
} as const;

type AccountReceivableRow = {
  id: string;
  customerId: string;
  saleId: string | null;
  manualInvoiceId: string | null;
  sale: { branchId: string; number: number } | null;
  manualInvoice: { branchId: string; electronicInvoice: { fullNumber: string } | null } | null;
  amount: unknown;
  balance: unknown;
  dueDate: Date;
  status: string;
};

function toRecord(row: AccountReceivableRow): AccountReceivableRecord {
  return {
    id: row.id,
    customerId: row.customerId,
    saleId: row.saleId,
    manualInvoiceId: row.manualInvoiceId,
    branchId: row.sale?.branchId ?? row.manualInvoice?.branchId ?? "",
    documentLabel: row.sale ? `#${row.sale.number}` : (row.manualInvoice?.electronicInvoice?.fullNumber ?? "manual"),
    amount: Number(row.amount),
    balance: Number(row.balance),
    dueDate: row.dueDate,
    status: row.status,
  };
}

function toPaymentRecord(row: {
  id: string;
  accountReceivableId: string;
  amount: unknown;
  method: string;
  status: string;
  reference: string | null;
  paidAt: Date;
}): AccountReceivablePaymentRecord {
  return {
    id: row.id,
    accountReceivableId: row.accountReceivableId,
    amount: Number(row.amount),
    method: row.method,
    status: row.status as "PENDING" | "REGISTERED" | "FAILED",
    reference: row.reference,
    paidAt: row.paidAt,
  };
}

export class PrismaAccountReceivableRepository implements IAccountReceivableRepository {
  async create(data: CreateAccountReceivableData): Promise<AccountReceivableRecord> {
    const row = await prisma.accountReceivable.create({
      data: {
        companyId: getTenantContext().companyId,
        customerId: data.customerId,
        saleId: data.saleId ?? null,
        manualInvoiceId: data.manualInvoiceId ?? null,
        amount: data.amount,
        balance: data.amount,
        dueDate: data.dueDate,
      },
      include: INCLUDE,
    });
    return toRecord(row);
  }

  async list(filter?: { status?: string }): Promise<AccountReceivableRecord[]> {
    const rows = await prisma.accountReceivable.findMany({
      where: filter?.status ? { status: filter.status } : undefined,
      include: INCLUDE,
      orderBy: { dueDate: "asc" },
    });
    return rows.map(toRecord);
  }

  async findByIdOrThrow(id: string): Promise<AccountReceivableRecord> {
    const row = await prisma.accountReceivable.findFirst({ where: { id }, include: INCLUDE });
    if (!row) throw new NotFoundError("AccountReceivable", id);
    return toRecord(row);
  }

  async listActive(): Promise<AccountReceivableRecord[]> {
    const rows = await prisma.accountReceivable.findMany({
      where: { status: { in: ["PENDING", "PARTIAL"] } },
      include: INCLUDE,
    });
    return rows.map(toRecord);
  }

  async findPaymentByIdOrThrow(id: string): Promise<AccountReceivablePaymentRecord> {
    const row = await prisma.accountReceivablePayment.findFirst({ where: { id } });
    if (!row) throw new NotFoundError("AccountReceivablePayment", id);
    return toPaymentRecord(row);
  }

  async registerPayment(accountReceivableId: string, amount: number, method: string, userId: string): Promise<RegisterReceivablePaymentResult> {
    return prisma.$transaction(async (tx) => {
      const current = await tx.accountReceivable.findFirst({ where: { id: accountReceivableId }, include: INCLUDE });
      if (!current) throw new NotFoundError("AccountReceivable", accountReceivableId);
      if (current.status === "CANCELLED") {
        throw new ValidationError("Esta cuenta por cobrar fue cancelada, no admite abonos");
      }

      const balance = Number(current.balance);
      if (amount > balance) {
        throw new ValidationError(`El abono (${amount}) no puede superar el saldo pendiente (${balance})`);
      }

      const newBalance = Math.round((balance - amount) * 100) / 100;
      const newStatus = newBalance === 0 ? "PAID" : "PARTIAL";

      const updated = await tx.accountReceivable.update({
        where: { id: accountReceivableId },
        data: { balance: newBalance, status: newStatus },
        include: INCLUDE,
      });

      const payment = await tx.accountReceivablePayment.create({
        data: { accountReceivableId, amount, method, status: "REGISTERED", createdByUserId: userId },
      });

      return { payment: toPaymentRecord(payment), accountReceivable: toRecord(updated) };
    });
  }

  async createPendingCheckoutPayment(accountReceivableId: string, amount: number, reference: string): Promise<AccountReceivablePaymentRecord> {
    await this.findByIdOrThrow(accountReceivableId);
    const payment = await prisma.accountReceivablePayment.create({
      data: { accountReceivableId, amount, method: "WOMPI", status: "PENDING", reference },
    });
    return toPaymentRecord(payment);
  }

  async findPaymentByReferenceCrossTenant(reference: string): Promise<ReceivablePaymentWithCompany | null> {
    // Sin contexto de tenant (el webhook de Wompi no manda JWT) -- basePrisma directo, mismo
    // motivo que PrismaSubscriptionRepository.findPaymentByReference en saas-admin.
    const payment = await basePrisma.accountReceivablePayment.findFirst({ where: { reference } });
    if (!payment) return null;
    const receivable = await basePrisma.accountReceivable.findFirst({
      where: { id: payment.accountReceivableId },
      select: { companyId: true },
    });
    if (!receivable) return null;
    return { payment: toPaymentRecord(payment), companyId: receivable.companyId };
  }

  async confirmCheckoutPayment(paymentId: string): Promise<RegisterReceivablePaymentResult> {
    return prisma.$transaction(async (tx) => {
      const payment = await tx.accountReceivablePayment.findFirst({ where: { id: paymentId } });
      if (!payment) throw new NotFoundError("AccountReceivablePayment", paymentId);

      const current = await tx.accountReceivable.findFirst({ where: { id: payment.accountReceivableId }, include: INCLUDE });
      if (!current) throw new NotFoundError("AccountReceivable", payment.accountReceivableId);

      const amount = Number(payment.amount);
      const balance = Number(current.balance);
      // El monto ya se fijo al generar el link -- si el saldo cambio mientras tanto (otro abono
      // en paralelo), se recorta al saldo restante en vez de dejarlo negativo.
      const applied = Math.min(amount, balance);
      const newBalance = Math.round((balance - applied) * 100) / 100;
      const newStatus = newBalance === 0 ? "PAID" : "PARTIAL";

      const updatedReceivable = await tx.accountReceivable.update({
        where: { id: current.id },
        data: { balance: newBalance, status: newStatus },
        include: INCLUDE,
      });
      const updatedPayment = await tx.accountReceivablePayment.update({
        where: { id: paymentId },
        data: { status: "REGISTERED" },
      });

      return { payment: toPaymentRecord(updatedPayment), accountReceivable: toRecord(updatedReceivable) };
    });
  }

  async failCheckoutPayment(paymentId: string): Promise<AccountReceivablePaymentRecord> {
    const payment = await prisma.accountReceivablePayment.update({ where: { id: paymentId }, data: { status: "FAILED" } });
    return toPaymentRecord(payment);
  }

  async cancel(accountReceivableId: string): Promise<AccountReceivableRecord> {
    return prisma.$transaction(async (tx) => {
      const current = await tx.accountReceivable.findFirst({ where: { id: accountReceivableId }, include: INCLUDE });
      if (!current) throw new NotFoundError("AccountReceivable", accountReceivableId);

      const existingPayment = await tx.accountReceivablePayment.findFirst({
        where: { accountReceivableId, status: { in: ["PENDING", "REGISTERED"] } },
      });
      if (existingPayment) {
        throw new ValidationError("Esta cuenta por cobrar ya tiene pagos registrados, no se puede cancelar");
      }

      const updated = await tx.accountReceivable.update({
        where: { id: accountReceivableId },
        data: { status: "CANCELLED" },
        include: INCLUDE,
      });
      return toRecord(updated);
    });
  }

  async hasReminderLog(accountReceivableId: string, daysBeforeDue: number): Promise<boolean> {
    const log = await prisma.accountReceivableReminderLog.findUnique({
      where: { accountReceivableId_daysBeforeDue: { accountReceivableId, daysBeforeDue } },
    });
    return log !== null;
  }

  async createReminderLog(accountReceivableId: string, daysBeforeDue: number, channel: string): Promise<void> {
    await prisma.accountReceivableReminderLog.create({ data: { accountReceivableId, daysBeforeDue, channel } });
  }

  async listPayments(filter: PaymentHistoryFilter): Promise<PaymentHistoryRow[]> {
    // Los abonos no tienen companyId: se filtran por la empresa de su cuenta por cobrar.
    const rows = await prisma.accountReceivablePayment.findMany({
      where: {
        status: { not: "PENDING" },
        paidAt: { gte: filter.from, lte: filter.to },
        accountReceivable: { companyId: getTenantContext().companyId, customerId: filter.customerId },
      },
      include: { accountReceivable: { select: { customerId: true, ...INCLUDE } } },
      orderBy: { paidAt: "desc" },
      take: 300,
    });
    const customerIds = [...new Set(rows.map((r) => r.accountReceivable.customerId))];
    const customers = customerIds.length
      ? await prisma.customer.findMany({ where: { id: { in: customerIds } }, select: { id: true, name: true, documentType: true, documentNumber: true } })
      : [];
    const byId = new Map(customers.map((c) => [c.id, c]));
    return rows.map((r) => {
      const c = byId.get(r.accountReceivable.customerId);
      const ar = r.accountReceivable;
      return {
        id: r.id,
        paidAt: r.paidAt,
        amount: Number(r.amount),
        method: r.method,
        status: r.status,
        customerName: c?.name ?? "-",
        customerDocument: c ? `${c.documentType} ${c.documentNumber}` : "",
        documentLabel: ar.sale ? `Venta #${ar.sale.number}` : (ar.manualInvoice?.electronicInvoice?.fullNumber ?? "Factura manual"),
      };
    });
  }
}
