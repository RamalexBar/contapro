import type { IElectronicDocumentSubmissionRepository } from "./electronic-document-submission.repository";
import type { ThirdPartyDocumentResult } from "./third-party-invoicing-client";

export interface GenerateElectronicSupportDocumentData {
  purchaseId: string;
  branchId: string;
  issueDate: Date;
  supplierDocumentType: string;
  supplierDocumentNumber: string;
  supplierName: string;
  subtotal: number;
  taxTotal: number;
  total: number;
  environment: "HABILITACION" | "PRODUCCION";
  /** Se envia por un proveedor tecnologico: numeracion interna (ver findResolutionForClaim). */
  viaThirdParty: boolean;
}

export interface ElectronicSupportDocumentRecord {
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
}

export interface ElectronicSupportDocumentWithXml extends ElectronicSupportDocumentRecord {
  xmlContent: string;
  signedXmlContent: string | null;
  dianTrackingId: string | null;
  rejectionReason: string | null;
  /** Solicitud enviada al proveedor tecnologico (JSON), si se envio por ahi. */
  providerRequest: string | null;
}

/** Analogo a IElectronicInvoiceRepository/IElectronicCreditNoteRepository, para documentos
 * soporte. Sin campo de referencia a otro documento -- el documento soporte es el original. */
export interface IElectronicSupportDocumentRepository extends IElectronicDocumentSubmissionRepository {
  claimNumberAndGenerate(
    data: GenerateElectronicSupportDocumentData,
    build: (fullNumber: string, prefix: string, number: number) => { cuds: string; xmlContent: string }
  ): Promise<ElectronicSupportDocumentRecord>;

  findByPurchaseId(purchaseId: string): Promise<ElectronicSupportDocumentWithXml | null>;

  /** Resultado de un proveedor tecnologico: numero legal, codigo unico y XML firmado reales, o el rechazo. */
  applyThirdPartyResult(id: string, result: ThirdPartyDocumentResult): Promise<void>;

  /** Guarda la solicitud al proveedor antes de enviarla, para que el reenvio mande la misma. */
  saveProviderRequest(id: string, request: string): Promise<void>;
}
