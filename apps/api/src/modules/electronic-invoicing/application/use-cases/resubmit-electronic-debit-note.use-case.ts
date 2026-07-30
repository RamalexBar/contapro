import { env } from "../../../../config/env";
import { ConflictError, NotFoundError, ValidationError } from "../../../../shared/errors/app-error";
import type { AuditService } from "../../../audit/application/audit.service";
import type { ICertificateLoader } from "../../domain/certificate-loader";
import type { IElectronicDebitNoteRepository } from "../../domain/electronic-debit-note.repository";
import type { IXmlSigner } from "../../domain/xml-signer";
import { signAndQueueElectronicDocument } from "../sign-and-queue-electronic-document";

/** Analogo a ResubmitElectronicCreditNoteUseCase, para notas debito. */
export class ResubmitElectronicDebitNoteUseCase {
  constructor(
    private readonly debitNoteRepo: IElectronicDebitNoteRepository,
    private readonly certificateLoader: ICertificateLoader,
    private readonly xmlSigner: IXmlSigner,
    private readonly audit: AuditService
  ) {}

  async execute(debitNoteId: string): Promise<void> {
    if (!env.DIAN_CERTIFICATE_PATH) {
      throw new ValidationError("No hay un certificado DIAN configurado (DIAN_CERTIFICATE_PATH)");
    }

    const note = await this.debitNoteRepo.findByDebitNoteId(debitNoteId);
    if (!note) throw new NotFoundError("ElectronicDebitNote", debitNoteId);

    if (note.status === "ACCEPTED" || note.status === "PENDING_SUBMISSION") {
      throw new ConflictError(`La nota debito ${note.fullNumber} ya esta ${note.status.toLowerCase()}, nada que reenviar`);
    }

    await signAndQueueElectronicDocument({
      certificateLoader: this.certificateLoader,
      xmlSigner: this.xmlSigner,
      submissionRepo: this.debitNoteRepo,
      audit: this.audit,
      certificatePath: env.DIAN_CERTIFICATE_PATH,
      certificatePassword: env.DIAN_CERTIFICATE_PASSWORD,
      documentId: note.id,
      entityType: "DebitNote",
      sourceEntityId: note.debitNoteId,
      fullNumber: note.fullNumber,
      unsignedXml: note.xmlContent,
      signingFailedAction: "ELECTRONIC_DEBIT_NOTE_SIGNING_FAILED",
      documentLabel: "la nota debito electronica",
    });
  }
}
