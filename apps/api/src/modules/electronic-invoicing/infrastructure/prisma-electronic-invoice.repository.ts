import { prisma } from "../../../shared/prisma/prisma-client";
import { getTenantContext } from "../../../shared/context/request-context";
import { ConflictError } from "../../../shared/errors/app-error";
import type {
  ApplyThirdPartyInvoiceResultInput,
  ElectronicInvoiceRecord,
  ElectronicInvoiceWithXml,
  GenerateElectronicInvoiceData,
  IElectronicInvoiceRepository,
} from "../domain/electronic-invoice.repository";
import type {
  ElectronicDocumentAwaitingStatus,
  ElectronicDocumentPendingSubmission,
} from "../domain/electronic-document-submission.repository";
import { claimNextDocumentNumber } from "../application/numbering-claim";

function toRecord(row: {
  id: string;
  saleId: string | null;
  manualInvoiceId: string | null;
  branchId: string;
  prefix: string;
  number: number;
  fullNumber: string;
  cufe: string;
  issueDate: Date;
  status: string;
  createdAt: Date;
}, resolutionNumber: string): ElectronicInvoiceRecord {
  return {
    id: row.id,
    saleId: row.saleId,
    manualInvoiceId: row.manualInvoiceId,
    branchId: row.branchId,
    prefix: row.prefix,
    number: row.number,
    fullNumber: row.fullNumber,
    resolutionNumber,
    cufe: row.cufe,
    issueDate: row.issueDate,
    status: row.status,
    createdAt: row.createdAt,
  };
}

export class PrismaElectronicInvoiceRepository implements IElectronicInvoiceRepository {
  async claimNumberAndGenerate(
    data: GenerateElectronicInvoiceData,
    build: (fullNumber: string, prefix: string, number: number) => { cufe: string; xmlContent: string }
  ): Promise<ElectronicInvoiceRecord> {
    const companyId = getTenantContext().companyId;
    const now = new Date();

    const row = await prisma.$transaction(async (tx) => {
      // Prefiere una resolucion especifica de la sucursal sobre una "toda la empresa"
      // (branchId null); dentro de cada grupo, la mas reciente por si hay varias vigentes.
      const resolution = await tx.invoiceNumberingResolution.findFirst({
        where: {
          companyId,
          documentType: "FACTURA_VENTA",
          isActive: true,
          validFrom: { lte: now },
          validUntil: { gte: now },
          OR: [{ branchId: data.branchId }, { branchId: null }],
        },
        orderBy: [{ branchId: "desc" }, { createdAt: "desc" }],
      });

      if (!resolution) {
        throw new ConflictError("No hay una resolucion de numeracion DIAN vigente para esta sucursal");
      }

      const { number, fullNumber } = await claimNextDocumentNumber(tx, resolution);

      const { cufe, xmlContent } = build(fullNumber, resolution.prefix, number);

      const invoice = await tx.electronicInvoice.create({
        data: {
          companyId,
          branchId: data.branchId,
          ...(data.source.type === "sale" ? { saleId: data.source.saleId } : { manualInvoiceId: data.source.manualInvoiceId }),
          numberingResolutionId: resolution.id,
          prefix: resolution.prefix,
          number,
          fullNumber,
          cufe,
          issueDate: data.issueDate,
          customerDocumentType: data.customerDocumentType,
          customerDocumentNumber: data.customerDocumentNumber,
          customerName: data.customerName,
          subtotal: data.subtotal,
          taxTotal: data.taxTotal,
          total: data.total,
          environment: data.environment,
          xmlContent,
        },
      });

      // updateMany (no update): Sale/ManualInvoice.update({where:{id}}) por si solo no queda
      // scoped al tenant (ver tenant.extension.ts) -- companyId ya esta disponible arriba, se
      // agrega al where.
      if (data.source.type === "sale") {
        await tx.sale.updateMany({
          where: { id: data.source.saleId, companyId },
          data: { cufe, invoiceXmlUrl: `/api/electronic-invoicing/sales/${data.source.saleId}/xml` },
        });
      } else {
        await tx.manualInvoice.updateMany({
          where: { id: data.source.manualInvoiceId, companyId },
          data: { cufe, invoiceXmlUrl: `/api/electronic-invoicing/manual-invoices/${data.source.manualInvoiceId}/xml` },
        });
      }

      return { invoice, resolutionNumber: resolution.resolutionNumber };
    });

    return toRecord(row.invoice, row.resolutionNumber);
  }

  async findBySaleId(saleId: string): Promise<ElectronicInvoiceWithXml | null> {
    const row = await prisma.electronicInvoice.findFirst({ where: { saleId }, include: { numberingResolution: true } });
    if (!row) return null;
    return {
      ...toRecord(row, row.numberingResolution.resolutionNumber),
      xmlContent: row.xmlContent,
      signedXmlContent: row.signedXmlContent,
      dianTrackingId: row.dianTrackingId,
      rejectionReason: row.rejectionReason,
    };
  }

  async findByManualInvoiceId(manualInvoiceId: string): Promise<ElectronicInvoiceWithXml | null> {
    const row = await prisma.electronicInvoice.findFirst({ where: { manualInvoiceId }, include: { numberingResolution: true } });
    if (!row) return null;
    return {
      ...toRecord(row, row.numberingResolution.resolutionNumber),
      xmlContent: row.xmlContent,
      signedXmlContent: row.signedXmlContent,
      dianTrackingId: row.dianTrackingId,
      rejectionReason: row.rejectionReason,
    };
  }

  // updateMany (no update): ElectronicInvoice.update({where:{id}}) por si solo no queda scoped
  // al tenant. Estos 4 metodos siempre corren con TenantContext disponible (via request HTTP o
  // via el contexto sintetico por empresa que establece dian-submission-poller.ts), asi que
  // getTenantContext() nunca lanza aqui.
  async markSigned(id: string, signedXmlContent: string): Promise<void> {
    const companyId = getTenantContext().companyId;
    await prisma.electronicInvoice.updateMany({
      where: { id, companyId },
      data: { signedXmlContent, status: "PENDING_SUBMISSION" },
    });
  }

  async markSubmitted(id: string, trackingId: string): Promise<void> {
    const companyId = getTenantContext().companyId;
    await prisma.electronicInvoice.updateMany({
      where: { id, companyId },
      data: { dianTrackingId: trackingId, submittedAt: new Date() },
    });
  }

  async markAccepted(id: string, responseXml: string): Promise<void> {
    const companyId = getTenantContext().companyId;
    await prisma.electronicInvoice.updateMany({
      where: { id, companyId },
      data: { status: "ACCEPTED", dianResponseXml: responseXml, respondedAt: new Date() },
    });
  }

  async markRejected(id: string, responseXml: string, reason: string): Promise<void> {
    const companyId = getTenantContext().companyId;
    await prisma.electronicInvoice.updateMany({
      where: { id, companyId },
      data: { status: "REJECTED", dianResponseXml: responseXml, rejectionReason: reason, respondedAt: new Date() },
    });
  }

  async applyThirdPartySubmissionResult(id: string, result: ApplyThirdPartyInvoiceResultInput): Promise<void> {
    const companyId = getTenantContext().companyId;
    const now = new Date();
    if (result.status === "ACCEPTED") {
      await prisma.electronicInvoice.updateMany({
        where: { id, companyId },
        data: {
          status: "ACCEPTED",
          cufe: result.cufe,
          xmlContent: result.signedXmlContent,
          signedXmlContent: result.signedXmlContent,
          dianResponseXml: result.rawResponse,
          submittedAt: now,
          respondedAt: now,
        },
      });
      // El CUFE local generado en claimNumberAndGenerate era provisional -- Sale.cufe/
      // ManualInvoice.cufe debe reflejar el CUFE real que autorizo la DIAN via el proveedor (ver
      // aviso en el use-case).
      const invoice = await prisma.electronicInvoice.findFirst({
        where: { id, companyId },
        select: { saleId: true, manualInvoiceId: true },
      });
      if (invoice?.saleId) {
        await prisma.sale.updateMany({ where: { id: invoice.saleId, companyId }, data: { cufe: result.cufe } });
      } else if (invoice?.manualInvoiceId) {
        await prisma.manualInvoice.updateMany({ where: { id: invoice.manualInvoiceId, companyId }, data: { cufe: result.cufe } });
      }
      return;
    }

    await prisma.electronicInvoice.updateMany({
      where: { id, companyId },
      data: {
        status: "REJECTED",
        dianResponseXml: result.rawResponse,
        rejectionReason: result.rejectionReason ?? "Rechazado por el proveedor (sin motivo especificado)",
        submittedAt: now,
        respondedAt: now,
      },
    });
  }

  async findPendingSubmission(limit: number): Promise<ElectronicDocumentPendingSubmission[]> {
    const rows = await prisma.electronicInvoice.findMany({
      where: { status: "PENDING_SUBMISSION", dianTrackingId: null },
      take: limit,
      orderBy: { createdAt: "asc" },
    });
    return rows.map((row) => ({
      id: row.id,
      sourceEntityId: (row.saleId ?? row.manualInvoiceId) as string,
      sourceEntityType: row.saleId ? "Sale" : "ManualInvoice",
      fullNumber: row.fullNumber,
      status: row.status,
      signedXmlContent: row.signedXmlContent,
    }));
  }

  async findAwaitingStatus(limit: number): Promise<ElectronicDocumentAwaitingStatus[]> {
    const rows = await prisma.electronicInvoice.findMany({
      where: { status: "PENDING_SUBMISSION", dianTrackingId: { not: null } },
      take: limit,
      orderBy: { submittedAt: "asc" },
    });
    return rows.map((row) => ({
      id: row.id,
      sourceEntityId: (row.saleId ?? row.manualInvoiceId) as string,
      sourceEntityType: row.saleId ? "Sale" : "ManualInvoice",
      fullNumber: row.fullNumber,
      status: row.status,
      dianTrackingId: row.dianTrackingId as string,
    }));
  }
}
