export interface ElectronicDocumentSubmissionRecord {
  id: string;
  /** Id de la entidad de negocio que origino el documento (Sale.id / CreditNote.id / DebitNote.id). */
  sourceEntityId: string;
  /** Solo lo puebla el repo de ElectronicInvoice (Sale | ManualInvoice, ver
   * electronic-invoice.repository.ts) -- es el unico tipo de documento cuya cola mezcla mas de
   * una entidad fuente. El resto de repos (nota credito/debito, documento soporte, nomina) lo
   * dejan undefined; PollDianSubmissionsUseCase usa su propio `entityType` del constructor en
   * ese caso. */
  sourceEntityType?: string;
  fullNumber: string;
  status: string;
}

export interface ElectronicDocumentPendingSubmission extends ElectronicDocumentSubmissionRecord {
  signedXmlContent: string | null;
}

export interface ElectronicDocumentAwaitingStatus extends ElectronicDocumentSubmissionRecord {
  dianTrackingId: string;
}

/**
 * Ciclo de vida de envio/consulta de estado a la DIAN, compartido por los 3 tipos de documento
 * electronico (factura, nota credito, nota debito) -- ver IElectronicInvoiceRepository (y sus
 * analogos para notas) para lo especifico de cada tipo: generacion de CUFE/CUDE y numeracion.
 * Extraido como puerto propio para que PollDianSubmissionsUseCase y
 * sign-and-queue-electronic-document.ts se puedan reusar sin duplicar la maquina de estados de
 * envio tres veces.
 */
export interface IElectronicDocumentSubmissionRepository {
  /** GENERATED -> PENDING_SUBMISSION, guarda el XML firmado. */
  markSigned(id: string, signedXmlContent: string): Promise<void>;
  /** Guarda el id de seguimiento devuelto por sendBillAsync. */
  markSubmitted(id: string, trackingId: string): Promise<void>;
  /** -> ACCEPTED */
  markAccepted(id: string, responseXml: string): Promise<void>;
  /** -> REJECTED */
  markRejected(id: string, responseXml: string, reason: string): Promise<void>;

  /** PENDING_SUBMISSION sin dianTrackingId todavia -- pendientes de enviar. */
  findPendingSubmission(limit: number): Promise<ElectronicDocumentPendingSubmission[]>;
  /** PENDING_SUBMISSION con dianTrackingId -- pendientes de consultar estado. */
  findAwaitingStatus(limit: number): Promise<ElectronicDocumentAwaitingStatus[]>;
}
