import { env } from "../../../../config/env";
import { ConflictError, NotFoundError, ValidationError } from "../../../../shared/errors/app-error";
import type { AuditService } from "../../../audit/application/audit.service";
import type { ICertificateLoader } from "../../domain/certificate-loader";
import type { IElectronicSupportDocumentRepository } from "../../domain/electronic-support-document.repository";
import type { IXmlSigner } from "../../domain/xml-signer";
import type { ICompanyReader } from "../../domain/company-reader.repository";
import type { IThirdPartyInvoicingClient, ThirdPartySupportDocumentInput } from "../../domain/third-party-invoicing-client";
import { getTenantContext } from "../../../../shared/context/request-context";
import { resubmitThirdPartyDocument } from "../resubmit-third-party-document";
import { parseProviderRequest } from "../submit-third-party-document";
import { signAndQueueElectronicDocument } from "../sign-and-queue-electronic-document";

/** Analogo a ResubmitElectronicCreditNoteUseCase, para documentos soporte. */
export class ResubmitElectronicSupportDocumentUseCase {
  constructor(
    private readonly supportDocumentRepo: IElectronicSupportDocumentRepository,
    private readonly certificateLoader: ICertificateLoader,
    private readonly xmlSigner: IXmlSigner,
    private readonly audit: AuditService,
    private readonly companyReader: ICompanyReader,
    private readonly providerClient: IThirdPartyInvoicingClient
  ) {}

  async execute(purchaseId: string): Promise<void> {
    const company = await this.companyReader.findByIdOrThrow(getTenantContext().companyId);
    if (company.electronicInvoicingProvider === "FACTUS") {
      const found = await this.supportDocumentRepo.findByPurchaseId(purchaseId);
      if (!found) throw new NotFoundError("Documento soporte", purchaseId);
      await resubmitThirdPartyDocument({
        company,
        document: found,
        submit: (credentials, raw) => this.providerClient.submitSupportDocument(credentials, parseProviderRequest<ThirdPartySupportDocumentInput>(raw, ["issueDate", "dueDate"])),
        apply: (result) => this.supportDocumentRepo.applyThirdPartyResult(found.id, result),
        audit: this.audit,
        entityType: "Purchase",
        entityId: purchaseId,
        label: "Documento soporte",
        failedAction: "ELECTRONIC_SUPPORT_DOCUMENT_GENERATION_FAILED",
      });
      return;
    }
    if (!env.DIAN_CERTIFICATE_PATH) {
      throw new ValidationError("No hay un certificado DIAN configurado (DIAN_CERTIFICATE_PATH)");
    }

    const doc = await this.supportDocumentRepo.findByPurchaseId(purchaseId);
    if (!doc) throw new NotFoundError("ElectronicSupportDocument", purchaseId);

    if (doc.status === "ACCEPTED" || doc.status === "PENDING_SUBMISSION") {
      throw new ConflictError(`El documento soporte ${doc.fullNumber} ya esta ${doc.status.toLowerCase()}, nada que reenviar`);
    }

    await signAndQueueElectronicDocument({
      certificateLoader: this.certificateLoader,
      xmlSigner: this.xmlSigner,
      submissionRepo: this.supportDocumentRepo,
      audit: this.audit,
      certificatePath: env.DIAN_CERTIFICATE_PATH,
      certificatePassword: env.DIAN_CERTIFICATE_PASSWORD,
      documentId: doc.id,
      entityType: "Purchase",
      sourceEntityId: doc.purchaseId,
      fullNumber: doc.fullNumber,
      unsignedXml: doc.xmlContent,
      signingFailedAction: "ELECTRONIC_SUPPORT_DOCUMENT_SIGNING_FAILED",
      documentLabel: "el documento soporte electronico",
    });
  }
}
