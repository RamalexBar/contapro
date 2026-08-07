import { prisma } from "../../../shared/prisma/prisma-client";
import { getTenantContext } from "../../../shared/context/request-context";
import { NotFoundError } from "../../../shared/errors/app-error";
import type {
  AdvanceNextRunData,
  CreateRecurringInvoiceData,
  IRecurringInvoiceRepository,
  RecordRunData,
  RecurringInvoiceRecord,
  RecurringInvoiceRunRecord,
  UpdateRecurringInvoiceData,
} from "../domain/recurring-invoice.repository";

type RecurringInvoiceRow = {
  id: string;
  customerId: string;
  branchId: string;
  name: string;
  dayOfMonth: number;
  priceListId: string | null;
  dueDays: number;
  isActive: boolean;
  nextRunDate: Date;
  lastRunDate: Date | null;
  createdAt: Date;
  items: { productId: string; quantity: unknown }[];
};

export class PrismaRecurringInvoiceRepository implements IRecurringInvoiceRepository {
  async create(data: CreateRecurringInvoiceData): Promise<RecurringInvoiceRecord> {
    const row = await prisma.recurringInvoice.create({
      data: {
        companyId: getTenantContext().companyId,
        customerId: data.customerId,
        branchId: data.branchId,
        name: data.name,
        dayOfMonth: data.dayOfMonth,
        priceListId: data.priceListId ?? null,
        dueDays: data.dueDays,
        nextRunDate: data.nextRunDate,
        items: { create: data.items.map((item) => ({ productId: item.productId, quantity: item.quantity })) },
      },
      include: { items: true },
    });
    return this.toRecord(row);
  }

  async list(): Promise<RecurringInvoiceRecord[]> {
    const rows = await prisma.recurringInvoice.findMany({ include: { items: true }, orderBy: { createdAt: "desc" } });
    return rows.map((row) => this.toRecord(row));
  }

  async findByIdOrThrow(id: string): Promise<RecurringInvoiceRecord> {
    const companyId = getTenantContext().companyId;
    const row = await prisma.recurringInvoice.findFirst({ where: { id, companyId }, include: { items: true } });
    if (!row) throw new NotFoundError("RecurringInvoice", id);
    return this.toRecord(row);
  }

  async update(id: string, data: UpdateRecurringInvoiceData): Promise<RecurringInvoiceRecord> {
    await this.findByIdOrThrow(id);
    const row = await prisma.recurringInvoice.update({
      where: { id },
      data: {
        name: data.name,
        dayOfMonth: data.dayOfMonth,
        priceListId: data.priceListId,
        dueDays: data.dueDays,
        nextRunDate: data.nextRunDate,
        ...(data.items
          ? {
              items: {
                deleteMany: {},
                create: data.items.map((item) => ({ productId: item.productId, quantity: item.quantity })),
              },
            }
          : {}),
      },
      include: { items: true },
    });
    return this.toRecord(row);
  }

  async deactivate(id: string): Promise<RecurringInvoiceRecord> {
    await this.findByIdOrThrow(id);
    const row = await prisma.recurringInvoice.update({
      where: { id },
      data: { isActive: false },
      include: { items: true },
    });
    return this.toRecord(row);
  }

  async listDue(now: Date): Promise<RecurringInvoiceRecord[]> {
    const rows = await prisma.recurringInvoice.findMany({
      where: { isActive: true, nextRunDate: { lte: now } },
      include: { items: true },
    });
    return rows.map((row) => this.toRecord(row));
  }

  async advanceNextRun(id: string, data: AdvanceNextRunData): Promise<void> {
    await prisma.recurringInvoice.update({
      where: { id },
      data: { nextRunDate: data.nextRunDate, lastRunDate: data.lastRunDate },
    });
  }

  async recordRun(data: RecordRunData): Promise<RecurringInvoiceRunRecord> {
    const row = await prisma.recurringInvoiceRun.create({
      data: {
        recurringInvoiceId: data.recurringInvoiceId,
        runDate: data.runDate,
        status: data.status,
        saleId: data.saleId ?? null,
        errorMessage: data.errorMessage ?? null,
      },
    });
    return row as RecurringInvoiceRunRecord;
  }

  async listRuns(recurringInvoiceId: string): Promise<RecurringInvoiceRunRecord[]> {
    const rows = await prisma.recurringInvoiceRun.findMany({
      where: { recurringInvoiceId },
      orderBy: { runDate: "desc" },
    });
    return rows as RecurringInvoiceRunRecord[];
  }

  private toRecord(row: RecurringInvoiceRow): RecurringInvoiceRecord {
    return {
      id: row.id,
      customerId: row.customerId,
      branchId: row.branchId,
      name: row.name,
      dayOfMonth: row.dayOfMonth,
      priceListId: row.priceListId,
      dueDays: row.dueDays,
      isActive: row.isActive,
      nextRunDate: row.nextRunDate,
      lastRunDate: row.lastRunDate,
      items: row.items.map((item) => ({ productId: item.productId, quantity: Number(item.quantity) })),
      createdAt: row.createdAt,
    };
  }
}
