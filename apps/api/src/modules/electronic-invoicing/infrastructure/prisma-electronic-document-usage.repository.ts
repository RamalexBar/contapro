import { prisma } from "../../../shared/prisma/prisma-client";
import type { IElectronicDocumentUsageRepository } from "../domain/electronic-document-usage.repository";

function startOfCurrentMonth(): Date {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), 1);
}

export class PrismaElectronicDocumentUsageRepository implements IElectronicDocumentUsageRepository {
  /** Solo ACCEPTED: confirmado con Factus (2026-09-22, ver memoria "Preguntas para Factus" /
   * dian-tech-provider) que un documento RECHAZADO por la DIAN no descuenta de la bolsa
   * comprada -- solo lo que "haya sido validado correctamente". Contar REJECTED aca sobreestimaria
   * el consumo real y mostraria al cliente una barra de progreso mas llena de lo que Factus
   * realmente les cobra. */
  async countThisMonth(): Promise<number> {
    const where = {
      status: "ACCEPTED" as const,
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
