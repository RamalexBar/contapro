import { prisma } from "../../../shared/prisma/prisma-client";
import { getTenantContext } from "../../../shared/context/request-context";
import { ConflictError } from "../../../shared/errors/app-error";
import type {
  ElectronicSupportDocumentRecord,
  ElectronicSupportDocumentWithXml,
  GenerateElectronicSupportDocumentData,
  IElectronicSupportDocumentRepository,
} from "../domain/electronic-support-document.repository";
import type {
  ElectronicDocumentAwaitingStatus,
  ElectronicDocumentPendingSubmission,
} from "../domain/electronic-document-submission.repository";
import { claimNextDocumentNumber } from "../application/numbering-claim";

function toRecord(row: {
  id: string;
  purchaseId: string;
  branchId: string;
  prefix: string;
  number: number;
  fullNumber: string;
  cuds: string;
  issueDate: Date;
  status: string;
  createdAt: Date;
}): ElectronicSupportDocumentRecord {
  return {
    id: row.id,
    purchaseId: row.purchaseId,
    branchId: row.branchId,
    prefix: row.prefix,
    number: row.number,
    fullNumber: row.fullNumber,
    cuds: row.cuds,
    issueDate: row.issueDate,
    status: row.status,
    createdAt: row.createdAt,
  };
}

/** Analogo a PrismaElectronicCreditNoteRepository, para documentos soporte. */
export class PrismaElectronicSupportDocumentRepository implements IElectronicSupportDocumentRepository {
  async claimNumberAndGenerate(
    data: GenerateElectronicSupportDocumentData,
    build: (fullNumber: string, prefix: string, number: number) => { cuds: string; xmlContent: string }
  ): Promise<ElectronicSupportDocumentRecord> {
    const companyId = getTenantContext().companyId;
    const now = new Date();

    const row = await prisma.$transaction(async (tx) => {
      const resolution = await tx.invoiceNumberingResolution.findFirst({
        where: {
          companyId,
          documentType: "DOCUMENTO_SOPORTE",
          isActive: true,
          validFrom: { lte: now },
          validUntil: { gte: now },
          OR: [{ branchId: data.branchId }, { branchId: null }],
        },
        orderBy: [{ branchId: "desc" }, { createdAt: "desc" }],
      });

      if (!resolution) {
        throw new ConflictError("No hay una resolucion de numeracion DIAN vigente para documentos soporte en esta sucursal");
      }

      const { number, fullNumber } = await claimNextDocumentNumber(tx, resolution);

      const { cuds, xmlContent } = build(fullNumber, resolution.prefix, number);

      const doc = await tx.electronicSupportDocument.create({
        data: {
          companyId,
          branchId: data.branchId,
          purchaseId: data.purchaseId,
          numberingResolutionId: resolution.id,
          prefix: resolution.prefix,
          number,
          fullNumber,
          cuds,
          issueDate: data.issueDate,
          supplierDocumentType: data.supplierDocumentType,
          supplierDocumentNumber: data.supplierDocumentNumber,
          supplierName: data.supplierName,
          subtotal: data.subtotal,
          taxTotal: data.taxTotal,
          total: data.total,
          environment: data.environment,
          xmlContent,
        },
      });

      // updateMany (no update): Purchase.update({where:{id}}) por si solo no queda scoped al
      // tenant -- companyId ya esta disponible arriba, se agrega al where.
      await tx.purchase.updateMany({
        where: { id: data.purchaseId, companyId },
        data: { cuds, xmlUrl: `/api/electronic-invoicing/purchases/${data.purchaseId}/xml` },
      });

      return doc;
    });

    return toRecord(row);
  }

  async findByPurchaseId(purchaseId: string): Promise<ElectronicSupportDocumentWithXml | null> {
    const row = await prisma.electronicSupportDocument.findFirst({ where: { purchaseId } });
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
    await prisma.electronicSupportDocument.updateMany({
      where: { id, companyId },
      data: { signedXmlContent, status: "PENDING_SUBMISSION" },
    });
  }

  async markSubmitted(id: string, trackingId: string): Promise<void> {
    const companyId = getTenantContext().companyId;
    await prisma.electronicSupportDocument.updateMany({
      where: { id, companyId },
      data: { dianTrackingId: trackingId, submittedAt: new Date() },
    });
  }

  async markAccepted(id: string, responseXml: string): Promise<void> {
    const companyId = getTenantContext().companyId;
    await prisma.electronicSupportDocument.updateMany({
      where: { id, companyId },
      data: { status: "ACCEPTED", dianResponseXml: responseXml, respondedAt: new Date() },
    });
  }

  async markRejected(id: string, responseXml: string, reason: string): Promise<void> {
    const companyId = getTenantContext().companyId;
    await prisma.electronicSupportDocument.updateMany({
      where: { id, companyId },
      data: { status: "REJECTED", dianResponseXml: responseXml, rejectionReason: reason, respondedAt: new Date() },
    });
  }

  async findPendingSubmission(limit: number): Promise<ElectronicDocumentPendingSubmission[]> {
    const rows = await prisma.electronicSupportDocument.findMany({
      where: { status: "PENDING_SUBMISSION", dianTrackingId: null },
      take: limit,
      orderBy: { createdAt: "asc" },
    });
    return rows.map((row) => ({
      id: row.id,
      sourceEntityId: row.purchaseId,
      fullNumber: row.fullNumber,
      status: row.status,
      signedXmlContent: row.signedXmlContent,
    }));
  }

  async findAwaitingStatus(limit: number): Promise<ElectronicDocumentAwaitingStatus[]> {
    const rows = await prisma.electronicSupportDocument.findMany({
      where: { status: "PENDING_SUBMISSION", dianTrackingId: { not: null } },
      take: limit,
      orderBy: { submittedAt: "asc" },
    });
    return rows.map((row) => ({
      id: row.id,
      sourceEntityId: row.purchaseId,
      fullNumber: row.fullNumber,
      status: row.status,
      dianTrackingId: row.dianTrackingId as string,
    }));
  }
}
