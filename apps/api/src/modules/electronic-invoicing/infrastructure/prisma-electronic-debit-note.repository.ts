import { prisma } from "../../../shared/prisma/prisma-client";
import { getTenantContext } from "../../../shared/context/request-context";
import type { ThirdPartyDocumentResult } from "../domain/third-party-invoicing-client";
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
import { claimNextDocumentNumber, findResolutionForClaim, splitProviderNumber } from "../application/numbering-claim";

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

    const row = await prisma.$transaction(async (tx) => {
      const resolution = await findResolutionForClaim(tx, {
        companyId,
        branchId: data.branchId,
        documentType: "NOTA_DEBITO",
        viaThirdParty: data.viaThirdParty,
      });

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
      providerRequest: row.providerRequest,
    };
  }

  // updateMany (no update): sin scoping propio quedaria expuesto a un id de otra empresa. Estos
  // 4 metodos siempre corren con TenantContext disponible (request HTTP o el contexto sintetico
  // por empresa que establece dian-submission-poller.ts).
  async saveProviderRequest(id: string, request: string): Promise<void> {
    const companyId = getTenantContext().companyId;
    await prisma.electronicDebitNote.updateMany({ where: { id, companyId }, data: { providerRequest: request } });
  }

  async applyThirdPartyResult(id: string, result: ThirdPartyDocumentResult): Promise<void> {
    const companyId = getTenantContext().companyId;
    const now = new Date();
    if (result.status === "REJECTED") {
      await prisma.electronicDebitNote.updateMany({
        where: { id, companyId },
        data: { status: "REJECTED", dianResponseXml: result.rawResponse, rejectionReason: result.rejectionReason ?? null, submittedAt: now, respondedAt: now },
      });
      return;
    }
    // El numero legal y el codigo unico son los del proveedor; el consecutivo interno queda reemplazado.
    const legal = splitProviderNumber(result.number);
    const doc = await prisma.electronicDebitNote.findFirst({ where: { id, companyId }, select: { debitNoteId: true } });
    await prisma.electronicDebitNote.updateMany({
      where: { id, companyId },
      data: {
        status: "ACCEPTED",
        cude: result.uniqueCode,
        ...(legal ? { prefix: legal.prefix, number: legal.number, fullNumber: result.number } : {}),
        ...(result.signedXmlContent ? { xmlContent: result.signedXmlContent, signedXmlContent: result.signedXmlContent } : {}),
        dianResponseXml: result.rawResponse,
        rejectionReason: null,
        submittedAt: now,
        respondedAt: now,
      },
    });
    if (doc) await prisma.debitNote.updateMany({ where: { id: doc.debitNoteId, companyId }, data: { cude: result.uniqueCode } });
  }

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
