import { prisma } from "../../../shared/prisma/prisma-client";
import { getTenantContext } from "../../../shared/context/request-context";
import { NotFoundError } from "../../../shared/errors/app-error";
import type {
  CreateManualInvoiceData,
  IManualInvoiceRepository,
  ManualInvoiceRecord,
} from "../domain/manual-invoice.repository";

export class PrismaManualInvoiceRepository implements IManualInvoiceRepository {
  async create(data: CreateManualInvoiceData): Promise<ManualInvoiceRecord> {
    // companyId explicito (tenant.extension.ts solo auto-inyecta si el llamador no lo trae) --
    // items se crean anidados en la misma llamada, mismo patron que PrismaQuoteRepository.create.
    const companyId = getTenantContext().companyId;
    const row = await prisma.manualInvoice.create({
      data: {
        companyId,
        branchId: data.branchId,
        customerId: data.customerId,
        createdByUserId: data.createdByUserId,
        issueDate: data.issueDate,
        subtotal: data.subtotal,
        taxTotal: data.taxTotal,
        total: data.total,
        items: { create: data.items },
      },
      include: { items: true },
    });
    return toRecord(row);
  }

  async findByIdOrThrow(id: string): Promise<ManualInvoiceRecord> {
    const row = await prisma.manualInvoice.findFirst({ where: { id }, include: { items: true } });
    if (!row) throw new NotFoundError("ManualInvoice", id);
    return toRecord(row);
  }

  async list(): Promise<ManualInvoiceRecord[]> {
    const rows = await prisma.manualInvoice.findMany({
      include: { items: true },
      orderBy: { createdAt: "desc" },
      take: 50,
    });
    return rows.map(toRecord);
  }
}

function toRecord(row: {
  id: string;
  branchId: string;
  customerId: string | null;
  createdByUserId: string;
  issueDate: Date;
  subtotal: unknown;
  taxTotal: unknown;
  total: unknown;
  cufe: string | null;
  invoiceXmlUrl: string | null;
  createdAt: Date;
  items: Array<{
    id: string;
    description: string;
    quantity: unknown;
    unitPrice: unknown;
    taxPercent: unknown;
    taxAmount: unknown;
    total: unknown;
  }>;
}): ManualInvoiceRecord {
  return {
    id: row.id,
    branchId: row.branchId,
    customerId: row.customerId,
    createdByUserId: row.createdByUserId,
    issueDate: row.issueDate,
    subtotal: Number(row.subtotal),
    taxTotal: Number(row.taxTotal),
    total: Number(row.total),
    cufe: row.cufe,
    invoiceXmlUrl: row.invoiceXmlUrl,
    createdAt: row.createdAt,
    items: row.items.map((item) => ({
      id: item.id,
      description: item.description,
      quantity: Number(item.quantity),
      unitPrice: Number(item.unitPrice),
      taxPercent: Number(item.taxPercent),
      taxAmount: Number(item.taxAmount),
      total: Number(item.total),
    })),
  };
}
