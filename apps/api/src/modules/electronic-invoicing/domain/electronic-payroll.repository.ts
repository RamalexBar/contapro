import type { IElectronicDocumentSubmissionRepository } from "./electronic-document-submission.repository";
import type { ThirdPartyDocumentResult } from "./third-party-invoicing-client";

export interface GenerateElectronicPayrollData {
  payrollDetailId: string;
  branchId: string;
  issueDate: Date;
  employeeDocumentType: string;
  employeeDocumentNumber: string;
  employeeName: string;
  grossTotal: number;
  totalDeductions: number;
  netPay: number;
  environment: "HABILITACION" | "PRODUCCION";
}

export interface ElectronicPayrollRecord {
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
}

export interface ElectronicPayrollWithXml extends ElectronicPayrollRecord {
  xmlContent: string;
  signedXmlContent: string | null;
  dianTrackingId: string | null;
  rejectionReason: string | null;
  /** Solicitud enviada al proveedor tecnologico (JSON), si se envio por ahi. */
  providerRequest: string | null;
}

/**
 * Analogo a IElectronicCreditNoteRepository, para nomina electronica -- pero SIN
 * claimNumberAndGenerate contra una resolucion DIAN: la nomina electronica no usa rango
 * autorizado (entendimiento general, sin verificar, ver README), el numero sale de un contador
 * simple en Company (Company.payrollElectronicSequence).
 */
export interface IElectronicPayrollRepository extends IElectronicDocumentSubmissionRepository {
  generateAndSave(
    data: GenerateElectronicPayrollData,
    build: (fullNumber: string, prefix: string | null, number: number) => { cune: string; xmlContent: string }
  ): Promise<ElectronicPayrollRecord>;

  findByPayrollDetailId(payrollDetailId: string): Promise<ElectronicPayrollWithXml | null>;

  /** La nomina electronica es mensual: un documento por empleado por mes. */
  findForEmployeeMonth(employeeId: string, year: number, month: number): Promise<{ payrollDetailId: string; status: string; fullNumber: string } | null>;

  saveProviderRequest(id: string, request: string): Promise<void>;

  /** Resultado de un proveedor tecnologico: numero legal, CUNE y XML firmado reales, o el rechazo. */
  applyThirdPartyResult(id: string, result: ThirdPartyDocumentResult): Promise<void>;
}
