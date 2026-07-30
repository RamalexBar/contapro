import type { AuditAction } from "../../audit/domain/audit-log.repository";
import type { AuditService } from "../../audit/application/audit.service";
import type { ICertificateLoader } from "../domain/certificate-loader";
import type { IElectronicDocumentSubmissionRepository } from "../domain/electronic-document-submission.repository";
import type { IXmlSigner } from "../domain/xml-signer";

export interface SignAndQueueElectronicDocumentParams {
  certificateLoader: ICertificateLoader;
  xmlSigner: IXmlSigner;
  submissionRepo: IElectronicDocumentSubmissionRepository;
  audit: AuditService;
  certificatePath: string;
  certificatePassword: string;
  documentId: string;
  entityType: string;
  sourceEntityId: string;
  fullNumber: string;
  unsignedXml: string;
  signingFailedAction: AuditAction;
  documentLabel: string;
}

/**
 * Firma un XML sin firmar y lo deja en PENDING_SUBMISSION para que el poller lo tome. Compartido
 * entre los 3 tipos de documento electronico (factura, nota credito, nota debito) y sus
 * respectivos casos de uso de generacion/reenvio manual, para no duplicar el mismo
 * try/catch+auditoria tres veces. Nunca lanza -- un fallo de firma no debe bloquear a quien lo
 * llama (venta/nota completandose, o el endpoint de reenvio manual).
 */
export async function signAndQueueElectronicDocument(params: SignAndQueueElectronicDocumentParams): Promise<void> {
  try {
    const cert = await params.certificateLoader.load(params.certificatePath, params.certificatePassword);
    const signedXml = await params.xmlSigner.sign(params.unsignedXml, cert);
    await params.submissionRepo.markSigned(params.documentId, signedXml);
  } catch (err) {
    await params.audit.record({
      action: params.signingFailedAction,
      entityType: params.entityType,
      entityId: params.sourceEntityId,
      description: `No se pudo firmar ${params.documentLabel} ${params.fullNumber}: ${(err as Error).message}`,
      metadata: { fullNumber: params.fullNumber },
    });
  }
}
