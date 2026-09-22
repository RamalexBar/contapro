import { prisma } from "../../../shared/prisma/prisma-client";
import type { IElectronicDocumentUsageRepository } from "../domain/electronic-document-usage.repository";

function startOfCurrentMonth(): Date {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), 1);
}

export class PrismaElectronicDocumentUsageRepository implements IElectronicDocumentUsageRepository {
  async countThisMonth(): Promise<number> {
    const where = {
      status: { in: ["ACCEPTED", "REJECTED"] as ("ACCEPTED" | "REJECTED")[] },
      createdAt: { gte: startOfCurrentMonth() },
    };

    const [invoices, creditNotes, debitNotes, supportDocuments, payroll] = await Promise.all([
      prisma.electronicInvoice.count({ where }),
      prisma.electronicCreditNote.count({ where }),
      prisma.electronicDebitNote.count({ where }),
      prisma.electronicSupportDocument.count({ where }),
      prisma.electronicPayroll.count({ where }),
    ]);

    return invoices + creditNotes + debitNotes + supportDocuments + payroll;
  }
}
