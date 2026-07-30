import { env } from "../../../../config/env";
import { ConflictError, NotFoundError, ValidationError } from "../../../../shared/errors/app-error";
import type { AuditService } from "../../../audit/application/audit.service";
import type { ICertificateLoader } from "../../domain/certificate-loader";
import type { IElectronicCreditNoteRepository } from "../../domain/electronic-credit-note.repository";
import type { IXmlSigner } from "../../domain/xml-signer";
import { signAndQueueElectronicDocument } from "../sign-and-queue-electronic-document";

/** Analogo a ResubmitElectronicInvoiceUseCase, para notas credito. */
export class ResubmitElectronicCreditNoteUseCase {
  constructor(
    private readonly creditNoteRepo: IElectronicCreditNoteRepository,
    private readonly certificateLoader: ICertificateLoader,
    private readonly xmlSigner: IXmlSigner,
    private readonly audit: AuditService
  ) {}

  async execute(creditNoteId: string): Promise<void> {
    if (!env.DIAN_CERTIFICATE_PATH) {
      throw new ValidationError("No hay un certificado DIAN configurado (DIAN_CERTIFICATE_PATH)");
    }

    const note = await this.creditNoteRepo.findByCreditNoteId(creditNoteId);
    if (!note) throw new NotFoundError("ElectronicCreditNote", creditNoteId);

    if (note.status === "ACCEPTED" || note.status === "PENDING_SUBMISSION") {
      throw new ConflictError(`La nota credito ${note.fullNumber} ya esta ${note.status.toLowerCase()}, nada que reenviar`);
    }

    await signAndQueueElectronicDocument({
      certificateLoader: this.certificateLoader,
      xmlSigner: this.xmlSigner,
      submissionRepo: this.creditNoteRepo,
      audit: this.audit,
      certificatePath: env.DIAN_CERTIFICATE_PATH,
      certificatePassword: env.DIAN_CERTIFICATE_PASSWORD,
      documentId: note.id,
      entityType: "CreditNote",
      sourceEntityId: note.creditNoteId,
      fullNumber: note.fullNumber,
      unsignedXml: note.xmlContent,
      signingFailedAction: "ELECTRONIC_CREDIT_NOTE_SIGNING_FAILED",
      documentLabel: "la nota credito electronica",
    });
  }
}
