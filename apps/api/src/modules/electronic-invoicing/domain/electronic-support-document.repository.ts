import type { IElectronicDocumentSubmissionRepository } from "./electronic-document-submission.repository";

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
}

/** Analogo a IElectronicInvoiceRepository/IElectronicCreditNoteRepository, para documentos
 * soporte. Sin campo de referencia a otro documento -- el documento soporte es el original. */
export interface IElectronicSupportDocumentRepository extends IElectronicDocumentSubmissionRepository {
  claimNumberAndGenerate(
    data: GenerateElectronicSupportDocumentData,
    build: (fullNumber: string, prefix: string, number: number) => { cuds: string; xmlContent: string }
  ): Promise<ElectronicSupportDocumentRecord>;

  findByPurchaseId(purchaseId: string): Promise<ElectronicSupportDocumentWithXml | null>;
}
