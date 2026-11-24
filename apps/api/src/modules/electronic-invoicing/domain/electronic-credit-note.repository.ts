import type { IElectronicDocumentSubmissionRepository } from "./electronic-document-submission.repository";
import type { ThirdPartyDocumentResult } from "./third-party-invoicing-client";

export interface GenerateElectronicCreditNoteData {
  creditNoteId: string;
  branchId: string;
  issueDate: Date;
  customerDocumentType: string;
  customerDocumentNumber: string;
  customerName: string;
  amount: number;
  taxAmount: number;
  reason: string;
  referenceCufe: string;
  environment: "HABILITACION" | "PRODUCCION";
  /** Se envia por un proveedor tecnologico: numeracion interna (ver findResolutionForClaim). */
  viaThirdParty: boolean;
}

export interface ElectronicCreditNoteRecord {
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
}

export interface ElectronicCreditNoteWithXml extends ElectronicCreditNoteRecord {
  xmlContent: string;
  signedXmlContent: string | null;
  dianTrackingId: string | null;
  rejectionReason: string | null;
  /** Solicitud enviada al proveedor tecnologico (JSON), si se envio por ahi. */
  providerRequest: string | null;
}

/** Analogo a IElectronicInvoiceRepository, para notas credito. Ver ese archivo para el porque
 * del diseño (numero reclamado atomicamente + CUDE/XML generados dentro de la misma transaccion). */
export interface IElectronicCreditNoteRepository extends IElectronicDocumentSubmissionRepository {
  claimNumberAndGenerate(
    data: GenerateElectronicCreditNoteData,
    build: (fullNumber: string, prefix: string, number: number) => { cude: string; xmlContent: string }
  ): Promise<ElectronicCreditNoteRecord>;

  findByCreditNoteId(creditNoteId: string): Promise<ElectronicCreditNoteWithXml | null>;

  /** Resultado de un proveedor tecnologico: numero legal, CUDE y XML firmado reales, o el rechazo. */
  applyThirdPartyResult(id: string, result: ThirdPartyDocumentResult): Promise<void>;

  /** Guarda la solicitud al proveedor antes de enviarla, para que el reenvio mande la misma. */
  saveProviderRequest(id: string, request: string): Promise<void>;
}
