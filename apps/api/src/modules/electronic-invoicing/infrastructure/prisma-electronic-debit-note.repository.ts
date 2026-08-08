import { prisma } from "../../../shared/prisma/prisma-client";
import { getTenantContext } from "../../../shared/context/request-context";
import { ConflictError } from "../../../shared/errors/app-error";
import type {
  ElectronicDebitNoteRecord,
  ElectronicDebitNoteWithXml,
  GenerateElectronicDebitNoteData,
  IElectronicDebitNoteRepository,
} from "../domain/electronic-debit-note.repository";
import type {
  ElectronicDocumentAwaitingStatus,
  ElectronicDocumentPendingSubmission,
} from "../domain/electronic-document-submission.repository";
import { claimNextDocumentNumber } from "../application/numbering-claim";

function toRecord(row: {
  id: string;
  debitNoteId: string;
  branchId: string;
  prefix: string;
  number: number;
  fullNumber: string;
  cude: string;
  issueDate: Date;
  status: string;
  createdAt: Date;
}): ElectronicDebitNoteRecord {
  return {
    id: row.id,
    debitNoteId: row.debitNoteId,
    branchId: row.branchId,
    prefix: row.prefix,
    number: row.number,
    fullNumber: row.fullNumber,
    cude: row.cude,
    issueDate: row.issueDate,
    status: row.status,
    createdAt: row.createdAt,
  };
}

/** Analogo a PrismaElectronicCreditNoteRepository, para notas debito. */
export class PrismaElectronicDebitNoteRepository implements IElectronicDebitNoteRepository {
  async claimNumberAndGenerate(
    data: GenerateElectronicDebitNoteData,
    build: (fullNumber: string, prefix: string, number: number) => { cude: string; xmlContent: string }
  ): Promise<ElectronicDebitNoteRecord> {
    const companyId = getTenantContext().companyId;
    const now = new Date();

    const row = await prisma.$transaction(async (tx) => {
      const resolution = await tx.invoiceNumberingResolution.findFirst({
        where: {
          companyId,
          documentType: "NOTA_DEBITO",
          isActive: true,
          validFrom: { lte: now },
          validUntil: { gte: now },
          OR: [{ branchId: data.branchId }, { branchId: null }],
        },
        orderBy: [{ branchId: "desc" }, { createdAt: "desc" }],
      });

      if (!resolution) {
        throw new ConflictError("No hay una resolucion de numeracion DIAN vigente para notas debito en esta sucursal");
      }

      const { number, fullNumber } = await claimNextDocumentNumber(tx, resolution);

      const { cude, xmlContent } = build(fullNumber, resolution.prefix, number);

      const note = await tx.electronicDebitNote.create({
        data: {
          companyId,
          branchId: data.branchId,
          debitNoteId: data.debitNoteId,
          numberingResolutionId: resolution.id,
          prefix: resolution.prefix,
          number,
          fullNumber,
          cude,
          referenceCufe: data.referenceCufe,
          issueDate: data.issueDate,
          customerDocumentType: data.customerDocumentType,
          customerDocumentNumber: data.customerDocumentNumber,
          customerName: data.customerName,
          amount: data.amount,
          environment: data.environment,
          xmlContent,
        },
      });

      // updateMany (no update): DebitNote.update({where:{id}}) por si solo no queda scoped al
      // tenant -- companyId ya esta disponible arriba, se agrega al where.
      await tx.debitNote.updateMany({
        where: { id: data.debitNoteId, companyId },
        data: { cude, xmlUrl: `/api/electronic-invoicing/debit-notes/${data.debitNoteId}/xml` },
      });

      return note;
    });

    return toRecord(row);
  }

  async findByDebitNoteId(debitNoteId: string): Promise<ElectronicDebitNoteWithXml | null> {
    const row = await prisma.electronicDebitNote.findFirst({ where: { debitNoteId } });
    if (!row) return null;
    return {
      ...toRecord(row),
      xmlContent: row.xmlContent,
      signedXmlContent: row.signedXmlContent,
      dianTrackingId: row.dianTrackingId,
      rejectionReason: row.rejectionReason,
    };
  }

  // updateMany (no update): sin scoping propio quedaria expuesto a un id de otra empresa. Estos
  // 4 metodos siempre corren con TenantContext disponible (request HTTP o el contexto sintetico
  // por empresa que establece dian-submission-poller.ts).
  async markSigned(id: string, signedXmlContent: string): Promise<void> {
    const companyId = getTenantContext().companyId;
    await prisma.electronicDebitNote.updateMany({
      where: { id, companyId },
      data: { signedXmlContent, status: "PENDING_SUBMISSION" },
    });
  }

  async markSubmitted(id: string, trackingId: string): Promise<void> {
    const companyId = getTenantContext().companyId;
    await prisma.electronicDebitNote.updateMany({
      where: { id, companyId },
      data: { dianTrackingId: trackingId, submittedAt: new Date() },
    });
  }

  async markAccepted(id: string, responseXml: string): Promise<void> {
    const companyId = getTenantContext().companyId;
    await prisma.electronicDebitNote.updateMany({
      where: { id, companyId },
      data: { status: "ACCEPTED", dianResponseXml: responseXml, respondedAt: new Date() },
    });
  }

  async markRejected(id: string, responseXml: string, reason: string): Promise<void> {
    const companyId = getTenantContext().companyId;
    await prisma.electronicDebitNote.updateMany({
      where: { id, companyId },
      data: { status: "REJECTED", dianResponseXml: responseXml, rejectionReason: reason, respondedAt: new Date() },
    });
  }

  async findPendingSubmission(limit: number): Promise<ElectronicDocumentPendingSubmission[]> {
    const rows = await prisma.electronicDebitNote.findMany({
      where: { status: "PENDING_SUBMISSION", dianTrackingId: null },
      take: limit,
      orderBy: { createdAt: "asc" },
    });
    return rows.map((row) => ({
      id: row.id,
      sourceEntityId: row.debitNoteId,
      fullNumber: row.fullNumber,
      status: row.status,
      signedXmlContent: row.signedXmlContent,
    }));
  }

  async findAwaitingStatus(limit: number): Promise<ElectronicDocumentAwaitingStatus[]> {
    const rows = await prisma.electronicDebitNote.findMany({
      where: { status: "PENDING_SUBMISSION", dianTrackingId: { not: null } },
      take: limit,
      orderBy: { submittedAt: "asc" },
    });
    return rows.map((row) => ({
      id: row.id,
      sourceEntityId: row.debitNoteId,
      fullNumber: row.fullNumber,
      status: row.status,
      dianTrackingId: row.dianTrackingId as string,
    }));
  }
}
