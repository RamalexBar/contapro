import { prisma } from "../../../shared/prisma/prisma-client";
import { getTenantContext } from "../../../shared/context/request-context";
import type { ThirdPartyDocumentResult } from "../domain/third-party-invoicing-client";
import type {
  ElectronicCreditNoteRecord,
  ElectronicCreditNoteWithXml,
  GenerateElectronicCreditNoteData,
  IElectronicCreditNoteRepository,
} from "../domain/electronic-credit-note.repository";
import type {
  ElectronicDocumentAwaitingStatus,
  ElectronicDocumentPendingSubmission,
} from "../domain/electronic-document-submission.repository";
import { claimNextDocumentNumber, findResolutionForClaim, splitProviderNumber } from "../application/numbering-claim";

function toRecord(row: {
  id: string;
  creditNoteId: string;
  branchId: string;
  prefix: string;
  number: number;
  fullNumber: string;
  cude: string;
  issueDate: Date;
  status: string;
  createdAt: Date;
}): ElectronicCreditNoteRecord {
  return {
    id: row.id,
    creditNoteId: row.creditNoteId,
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

/** Analogo a PrismaElectronicInvoiceRepository, para notas credito. */
export class PrismaElectronicCreditNoteRepository implements IElectronicCreditNoteRepository {
  async claimNumberAndGenerate(
    data: GenerateElectronicCreditNoteData,
    build: (fullNumber: string, prefix: string, number: number) => { cude: string; xmlContent: string }
  ): Promise<ElectronicCreditNoteRecord> {
    const companyId = getTenantContext().companyId;

    const row = await prisma.$transaction(async (tx) => {
      const resolution = await findResolutionForClaim(tx, {
        companyId,
        branchId: data.branchId,
        documentType: "NOTA_CREDITO",
        viaThirdParty: data.viaThirdParty,
      });

      const { number, fullNumber } = await claimNextDocumentNumber(tx, resolution);

      const { cude, xmlContent } = build(fullNumber, resolution.prefix, number);

      const note = await tx.electronicCreditNote.create({
        data: {
          companyId,
          branchId: data.branchId,
          creditNoteId: data.creditNoteId,
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

      // updateMany (no update): CreditNote.update({where:{id}}) por si solo no queda scoped al
      // tenant -- companyId ya esta disponible arriba, se agrega al where.
      await tx.creditNote.updateMany({
        where: { id: data.creditNoteId, companyId },
        data: { cude, xmlUrl: `/api/electronic-invoicing/credit-notes/${data.creditNoteId}/xml` },
      });

      return note;
    });

    return toRecord(row);
  }

  async findByCreditNoteId(creditNoteId: string): Promise<ElectronicCreditNoteWithXml | null> {
    const row = await prisma.electronicCreditNote.findFirst({ where: { creditNoteId } });
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

  async saveProviderRequest(id: string, request: string): Promise<void> {
    const companyId = getTenantContext().companyId;
    await prisma.electronicCreditNote.updateMany({ where: { id, companyId }, data: { providerRequest: request } });
  }

  async applyThirdPartyResult(id: string, result: ThirdPartyDocumentResult): Promise<void> {
    const companyId = getTenantContext().companyId;
    const now = new Date();
    if (result.status === "REJECTED") {
      await prisma.electronicCreditNote.updateMany({
        where: { id, companyId },
        data: { status: "REJECTED", dianResponseXml: result.rawResponse, rejectionReason: result.rejectionReason ?? null, submittedAt: now, respondedAt: now },
      });
      return;
    }
    // El numero legal y el CUDE son los del proveedor; el consecutivo interno queda reemplazado.
    const legal = splitProviderNumber(result.number);
    const note = await prisma.electronicCreditNote.findFirst({ where: { id, companyId }, select: { creditNoteId: true } });
    await prisma.electronicCreditNote.updateMany({
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
    if (note) await prisma.creditNote.updateMany({ where: { id: note.creditNoteId, companyId }, data: { cude: result.uniqueCode } });
  }

  // updateMany (no update): sin scoping propio quedaria expuesto a un id de otra empresa. Estos
  // 4 metodos siempre corren con TenantContext disponible (request HTTP o el contexto sintetico
  // por empresa que establece dian-submission-poller.ts).
  async markSigned(id: string, signedXmlContent: string): Promise<void> {
    const companyId = getTenantContext().companyId;
    await prisma.electronicCreditNote.updateMany({
      where: { id, companyId },
      data: { signedXmlContent, status: "PENDING_SUBMISSION" },
    });
  }

  async markSubmitted(id: string, trackingId: string): Promise<void> {
    const companyId = getTenantContext().companyId;
    await prisma.electronicCreditNote.updateMany({
      where: { id, companyId },
      data: { dianTrackingId: trackingId, submittedAt: new Date() },
    });
  }

  async markAccepted(id: string, responseXml: string): Promise<void> {
    const companyId = getTenantContext().companyId;
    await prisma.electronicCreditNote.updateMany({
      where: { id, companyId },
      data: { status: "ACCEPTED", dianResponseXml: responseXml, respondedAt: new Date() },
    });
  }

  async markRejected(id: string, responseXml: string, reason: string): Promise<void> {
    const companyId = getTenantContext().companyId;
    await prisma.electronicCreditNote.updateMany({
      where: { id, companyId },
      data: { status: "REJECTED", dianResponseXml: responseXml, rejectionReason: reason, respondedAt: new Date() },
    });
  }

  async findPendingSubmission(limit: number): Promise<ElectronicDocumentPendingSubmission[]> {
    const rows = await prisma.electronicCreditNote.findMany({
      where: { status: "PENDING_SUBMISSION", dianTrackingId: null },
      take: limit,
      orderBy: { createdAt: "asc" },
    });
    return rows.map((row) => ({
      id: row.id,
      sourceEntityId: row.creditNoteId,
      fullNumber: row.fullNumber,
      status: row.status,
      signedXmlContent: row.signedXmlContent,
    }));
  }

  async findAwaitingStatus(limit: number): Promise<ElectronicDocumentAwaitingStatus[]> {
    const rows = await prisma.electronicCreditNote.findMany({
      where: { status: "PENDING_SUBMISSION", dianTrackingId: { not: null } },
      take: limit,
      orderBy: { submittedAt: "asc" },
    });
    return rows.map((row) => ({
      id: row.id,
      sourceEntityId: row.creditNoteId,
      fullNumber: row.fullNumber,
      status: row.status,
      dianTrackingId: row.dianTrackingId as string,
    }));
  }
}
