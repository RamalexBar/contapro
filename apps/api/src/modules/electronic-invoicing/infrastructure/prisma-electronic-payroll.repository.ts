import { basePrisma } from "@erp/database";
import { prisma } from "../../../shared/prisma/prisma-client";
import { getTenantContext } from "../../../shared/context/request-context";
import type {
  ElectronicPayrollRecord,
  ElectronicPayrollWithXml,
  GenerateElectronicPayrollData,
  IElectronicPayrollRepository,
} from "../domain/electronic-payroll.repository";
import type {
  ElectronicDocumentAwaitingStatus,
  ElectronicDocumentPendingSubmission,
} from "../domain/electronic-document-submission.repository";

function toRecord(row: {
  id: string;
  payrollDetailId: string;
  branchId: string;
  prefix: string | null;
  number: number;
  fullNumber: string;
  cune: string;
  issueDate: Date;
  status: string;
  createdAt: Date;
}): ElectronicPayrollRecord {
  return {
    id: row.id,
    payrollDetailId: row.payrollDetailId,
    branchId: row.branchId,
    prefix: row.prefix,
    number: row.number,
    fullNumber: row.fullNumber,
    cune: row.cune,
    issueDate: row.issueDate,
    status: row.status,
    createdAt: row.createdAt,
  };
}

/**
 * A diferencia de los demas repos Electronic*, este NO reclama numero contra una
 * InvoiceNumberingResolution -- usa un contador atomico simple en Company
 * (payrollElectronicSequence), via basePrisma (Company no esta en TENANT_MODELS, es el tenant
 * mismo, ver prisma-company-reader.repository.ts). La transaccion completa corre sobre
 * basePrisma (sin la extension de aislamiento) porque Company se maneja siempre asi; companyId
 * se pasa explicito en el create de ElectronicPayroll, igual que ya hacen los demas repos.
 */
export class PrismaElectronicPayrollRepository implements IElectronicPayrollRepository {
  async generateAndSave(
    data: GenerateElectronicPayrollData,
    build: (fullNumber: string, prefix: string | null, number: number) => { cune: string; xmlContent: string }
  ): Promise<ElectronicPayrollRecord> {
    const companyId = getTenantContext().companyId;

    const row = await basePrisma.$transaction(async (tx) => {
      const company = await tx.company.update({
        where: { id: companyId },
        data: { payrollElectronicSequence: { increment: 1 } },
      });

      const number = company.payrollElectronicSequence;
      const prefix = company.payrollElectronicPrefix;
      const fullNumber = `${prefix ?? ""}${number}`;

      const { cune, xmlContent } = build(fullNumber, prefix, number);

      const doc = await tx.electronicPayroll.create({
        data: {
          companyId,
          branchId: data.branchId,
          payrollDetailId: data.payrollDetailId,
          prefix,
          number,
          fullNumber,
          cune,
          issueDate: data.issueDate,
          employeeDocumentType: data.employeeDocumentType,
          employeeDocumentNumber: data.employeeDocumentNumber,
          employeeName: data.employeeName,
          grossTotal: data.grossTotal,
          totalDeductions: data.totalDeductions,
          netPay: data.netPay,
          environment: data.environment,
          xmlContent,
        },
      });

      // updateMany (no update): esta transaccion corre sobre basePrisma (sin la extension de
      // tenant en absoluto, ver nota de clase arriba). PayrollDetail no tiene companyId propio
      // (hijo de Payroll), se filtra via la relacion.
      await tx.payrollDetail.updateMany({
        where: { id: data.payrollDetailId, payroll: { companyId } },
        data: { cune, xmlUrl: `/api/electronic-invoicing/payroll-details/${data.payrollDetailId}/xml` },
      });

      return doc;
    });

    return toRecord(row);
  }

  async findByPayrollDetailId(payrollDetailId: string): Promise<ElectronicPayrollWithXml | null> {
    const row = await prisma.electronicPayroll.findFirst({ where: { payrollDetailId } });
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
    await prisma.electronicPayroll.updateMany({
      where: { id, companyId },
      data: { signedXmlContent, status: "PENDING_SUBMISSION" },
    });
  }

  async markSubmitted(id: string, trackingId: string): Promise<void> {
    const companyId = getTenantContext().companyId;
    await prisma.electronicPayroll.updateMany({
      where: { id, companyId },
      data: { dianTrackingId: trackingId, submittedAt: new Date() },
    });
  }

  async markAccepted(id: string, responseXml: string): Promise<void> {
    const companyId = getTenantContext().companyId;
    await prisma.electronicPayroll.updateMany({
      where: { id, companyId },
      data: { status: "ACCEPTED", dianResponseXml: responseXml, respondedAt: new Date() },
    });
  }

  async markRejected(id: string, responseXml: string, reason: string): Promise<void> {
    const companyId = getTenantContext().companyId;
    await prisma.electronicPayroll.updateMany({
      where: { id, companyId },
      data: { status: "REJECTED", dianResponseXml: responseXml, rejectionReason: reason, respondedAt: new Date() },
    });
  }

  async findPendingSubmission(limit: number): Promise<ElectronicDocumentPendingSubmission[]> {
    const rows = await prisma.electronicPayroll.findMany({
      where: { status: "PENDING_SUBMISSION", dianTrackingId: null },
      take: limit,
      orderBy: { createdAt: "asc" },
    });
    return rows.map((row) => ({
      id: row.id,
      sourceEntityId: row.payrollDetailId,
      fullNumber: row.fullNumber,
      status: row.status,
      signedXmlContent: row.signedXmlContent,
    }));
  }

  async findAwaitingStatus(limit: number): Promise<ElectronicDocumentAwaitingStatus[]> {
    const rows = await prisma.electronicPayroll.findMany({
      where: { status: "PENDING_SUBMISSION", dianTrackingId: { not: null } },
      take: limit,
      orderBy: { submittedAt: "asc" },
    });
    return rows.map((row) => ({
      id: row.id,
      sourceEntityId: row.payrollDetailId,
      fullNumber: row.fullNumber,
      status: row.status,
      dianTrackingId: row.dianTrackingId as string,
    }));
  }
}
