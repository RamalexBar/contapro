import type { IElectronicDocumentSubmissionRepository } from "./electronic-document-submission.repository";

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
}

/** Analogo a IElectronicCreditNoteRepository, para notas debito. */
export interface IElectronicDebitNoteRepository extends IElectronicDocumentSubmissionRepository {
  claimNumberAndGenerate(
    data: GenerateElectronicDebitNoteData,
    build: (fullNumber: string, prefix: string, number: number) => { cude: string; xmlContent: string }
  ): Promise<ElectronicDebitNoteRecord>;

  findByDebitNoteId(debitNoteId: string): Promise<ElectronicDebitNoteWithXml | null>;
}
