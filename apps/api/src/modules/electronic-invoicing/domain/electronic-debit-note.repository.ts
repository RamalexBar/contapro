import type { IElectronicDocumentSubmissionRepository } from "./electronic-document-submission.repository";
import type { ThirdPartyDocumentResult } from "./third-party-invoicing-client";

export interface GenerateElectronicDebitNoteData {
  debitNoteId: string;
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

export interface ElectronicDebitNoteRecord {
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
}

export interface ElectronicDebitNoteWithXml extends ElectronicDebitNoteRecord {
  xmlContent: string;
  signedXmlContent: string | null;
  dianTrackingId: string | null;
  rejectionReason: string | null;
  /** Solicitud enviada al proveedor tecnologico (JSON), si se envio por ahi. */
  providerRequest: string | null;
}

/** Analogo a IElectronicCreditNoteRepository, para notas debito. */
export interface IElectronicDebitNoteRepository extends IElectronicDocumentSubmissionRepository {
  claimNumberAndGenerate(
    data: GenerateElectronicDebitNoteData,
    build: (fullNumber: string, prefix: string, number: number) => { cude: string; xmlContent: string }
  ): Promise<ElectronicDebitNoteRecord>;

  findByDebitNoteId(debitNoteId: string): Promise<ElectronicDebitNoteWithXml | null>;

  /** Resultado de un proveedor tecnologico: numero legal, codigo unico y XML firmado reales, o el rechazo. */
  applyThirdPartyResult(id: string, result: ThirdPartyDocumentResult): Promise<void>;

  /** Guarda la solicitud al proveedor antes de enviarla, para que el reenvio mande la misma. */
  saveProviderRequest(id: string, request: string): Promise<void>;
}
