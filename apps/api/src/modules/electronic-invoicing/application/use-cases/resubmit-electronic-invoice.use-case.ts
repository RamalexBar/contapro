import { env } from "../../../../config/env";
import { ConflictError, NotFoundError, ValidationError } from "../../../../shared/errors/app-error";
import type { AuditService } from "../../../audit/application/audit.service";
import type { ICertificateLoader } from "../../domain/certificate-loader";
import type { IElectronicInvoiceRepository } from "../../domain/electronic-invoice.repository";
import type { IXmlSigner } from "../../domain/xml-signer";
import { signAndQueueElectronicDocument } from "../sign-and-queue-electronic-document";

/**
 * Recuperacion manual para una factura que quedo GENERADA-sin-firmar (fallo la firma) o
 * REJECTED (la DIAN la rechazo). Re-arma la firma y la deja en PENDING_SUBMISSION para que el
 * poller la retome -- no llama a la DIAN directamente desde aqui, para mantener "quien habla
 * con la DIAN" en un solo lugar (PollDianSubmissionsUseCase).
 */
export class ResubmitElectronicInvoiceUseCase {
  constructor(
    private readonly invoiceRepo: IElectronicInvoiceRepository,
    private readonly certificateLoader: ICertificateLoader,
    private readonly xmlSigner: IXmlSigner,
    private readonly audit: AuditService
  ) {}

  async execute(saleId: string): Promise<void> {
    if (!env.DIAN_CERTIFICATE_PATH) {
      throw new ValidationError("No hay un certificado DIAN configurado (DIAN_CERTIFICATE_PATH)");
    }

    const invoice = await this.invoiceRepo.findBySaleId(saleId);
    if (!invoice) throw new NotFoundError("ElectronicInvoice", saleId);

    if (invoice.status === "ACCEPTED" || invoice.status === "PENDING_SUBMISSION") {
      throw new ConflictError(`La factura ${invoice.fullNumber} ya esta ${invoice.status.toLowerCase()}, nada que reenviar`);
    }

    await signAndQueueElectronicDocument({
      certificateLoader: this.certificateLoader,
      xmlSigner: this.xmlSigner,
      submissionRepo: this.invoiceRepo,
      audit: this.audit,
      certificatePath: env.DIAN_CERTIFICATE_PATH,
      certificatePassword: env.DIAN_CERTIFICATE_PASSWORD,
      documentId: invoice.id,
      entityType: "Sale",
      sourceEntityId: invoice.saleId,
      fullNumber: invoice.fullNumber,
      unsignedXml: invoice.xmlContent,
      signingFailedAction: "ELECTRONIC_INVOICE_SIGNING_FAILED",
      documentLabel: "la factura electronica",
    });
  }
}
