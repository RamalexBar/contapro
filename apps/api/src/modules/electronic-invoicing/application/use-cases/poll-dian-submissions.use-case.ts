import type { AuditService } from "../../../audit/application/audit.service";
import type { IDianClient } from "../../domain/dian-client";
import type { IElectronicDocumentSubmissionRepository } from "../../domain/electronic-document-submission.repository";

const BATCH_SIZE = 20;

/**
 * Una "tanda" de polling: (1) envia a la DIAN los documentos firmados que aun no se han enviado,
 * (2) consulta el estado de los que ya se enviaron y estan esperando respuesta. Generico sobre
 * el tipo de documento (factura/nota credito/nota debito) via IElectronicDocumentSubmissionRepository
 * -- se instancia una vez por tipo (ver electronic-invoicing.container.ts), cada una con su
 * propio repositorio concreto y `entityType`/`documentLabel` para que la auditoria diga
 * "Factura electronica"/"Nota credito electronica"/etc. Pensado para correr periodicamente desde
 * un poller en proceso (ver infrastructure/dian-submission-poller.ts). Ningun fallo de red
 * interrumpe el ciclo -- se reintenta en la siguiente tanda.
 */
export class PollDianSubmissionsUseCase {
  constructor(
    private readonly submissionRepo: IElectronicDocumentSubmissionRepository,
    private readonly dianClient: IDianClient,
    private readonly audit: AuditService,
    private readonly entityType: string,
    private readonly documentLabel: string
  ) {}

  async execute(): Promise<void> {
    await this.submitPending();
    await this.checkAwaitingStatus();
  }

  private async submitPending(): Promise<void> {
    const pending = await this.submissionRepo.findPendingSubmission(BATCH_SIZE);
    for (const doc of pending) {
      if (!doc.signedXmlContent) continue; // no deberia pasar, pero por si acaso
      try {
        const { trackingId } = await this.dianClient.sendBillAsync(doc.signedXmlContent);
        await this.submissionRepo.markSubmitted(doc.id, trackingId);
        await this.audit.record({
          action: "ELECTRONIC_DOCUMENT_SUBMITTED",
          entityType: doc.sourceEntityType ?? this.entityType,
          entityId: doc.sourceEntityId,
          description: `${this.documentLabel} ${doc.fullNumber} enviada a la DIAN (tracking ${trackingId})`,
          metadata: { fullNumber: doc.fullNumber, trackingId },
        });
      } catch {
        // se reintenta en la siguiente tanda; no se audita cada intento fallido para no
        // inundar el log si la DIAN esta caida.
      }
    }
  }

  private async checkAwaitingStatus(): Promise<void> {
    const awaiting = await this.submissionRepo.findAwaitingStatus(BATCH_SIZE);
    for (const doc of awaiting) {
      try {
        const result = await this.dianClient.getStatus(doc.dianTrackingId);
        if (result.status === "ACCEPTED") {
          await this.submissionRepo.markAccepted(doc.id, result.responseXml ?? "");
          await this.audit.record({
            action: "ELECTRONIC_DOCUMENT_ACCEPTED",
            entityType: doc.sourceEntityType ?? this.entityType,
            entityId: doc.sourceEntityId,
            description: `${this.documentLabel} ${doc.fullNumber} aceptada por la DIAN`,
            metadata: { fullNumber: doc.fullNumber },
          });
        } else if (result.status === "REJECTED") {
          await this.submissionRepo.markRejected(doc.id, result.responseXml ?? "", result.rejectionReason ?? "Rechazado");
          await this.audit.record({
            action: "ELECTRONIC_DOCUMENT_REJECTED",
            entityType: doc.sourceEntityType ?? this.entityType,
            entityId: doc.sourceEntityId,
            description: `${this.documentLabel} ${doc.fullNumber} rechazada por la DIAN: ${result.rejectionReason ?? "sin motivo"}`,
            metadata: { fullNumber: doc.fullNumber, rejectionReason: result.rejectionReason },
          });
        }
        // PENDING: no-op, se vuelve a consultar en la siguiente tanda.
      } catch {
        // igual que arriba: se reintenta despues, sin ruido en el log por cada fallo de red.
      }
    }
  }
}
