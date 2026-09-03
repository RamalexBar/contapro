import { env } from "../../../../config/env";
import { ConflictError, NotFoundError, ValidationError } from "../../../../shared/errors/app-error";
import { getTenantContext } from "../../../../shared/context/request-context";
import { decryptCredential } from "../../../../shared/crypto/credential-cipher";
import type { AuditService } from "../../../audit/application/audit.service";
import type { ICertificateLoader } from "../../domain/certificate-loader";
import type { ICompanyReader } from "../../domain/company-reader.repository";
import type { IElectronicInvoiceRepository } from "../../domain/electronic-invoice.repository";
import type { IThirdPartyInvoicingClient } from "../../domain/third-party-invoicing-client";
import type { IXmlSigner } from "../../domain/xml-signer";
import { signAndQueueElectronicDocument } from "../sign-and-queue-electronic-document";
import { extractUblDocument } from "../xml-document-extractor";

/**
 * Recuperacion manual para una factura que quedo GENERADA-sin-firmar (fallo la firma o la
 * llamada al proveedor) o REJECTED. En modo DIRECT re-arma la firma y la deja en
 * PENDING_SUBMISSION para que el poller la retome. En modo MATIAS (ver README del modulo,
 * seccion "Proveedor tecnologico") reintenta el envio al proveedor directamente aqui -- ese
 * camino es sincrono (sin poller), asi que no hay "quien habla con la DIAN" que reusar como en
 * el flujo DIRECT.
 */
export class ResubmitElectronicInvoiceUseCase {
  constructor(
    private readonly invoiceRepo: IElectronicInvoiceRepository,
    private readonly certificateLoader: ICertificateLoader,
    private readonly xmlSigner: IXmlSigner,
    private readonly audit: AuditService,
    private readonly companyReader: ICompanyReader,
    private readonly thirdPartyClient: IThirdPartyInvoicingClient
  ) {}

  async execute(query: { type: "sale"; id: string } | { type: "manual"; id: string }): Promise<void> {
    const invoice =
      query.type === "sale" ? await this.invoiceRepo.findBySaleId(query.id) : await this.invoiceRepo.findByManualInvoiceId(query.id);
    if (!invoice) throw new NotFoundError("ElectronicInvoice", query.id);

    const entityType = invoice.saleId ? "Sale" : "ManualInvoice";
    const entityId = (invoice.saleId ?? invoice.manualInvoiceId) as string;

    if (invoice.status === "ACCEPTED" || invoice.status === "PENDING_SUBMISSION") {
      throw new ConflictError(`La factura ${invoice.fullNumber} ya esta ${invoice.status.toLowerCase()}, nada que reenviar`);
    }

    const company = await this.companyReader.findByIdOrThrow(getTenantContext().companyId);

    if (company.electronicInvoicingProvider === "MATIAS") {
      if (!company.matiasApiTokenEncrypted) {
        throw new ValidationError("Esta empresa usa el proveedor MATIAS pero no tiene un token cargado");
      }
      // ElectronicInvoice no guarda customerId ni las lineas por separado (ver README, punto 13:
      // "el XML es la unica fuente disponible") -- se reconstruyen del xmlContent local ya
      // guardado (mismo extractor que usa el RIDE). Limitacion real: los catalogos DIAN del
      // proveedor (regimen IVA, ciudad, etc., ver domain/third-party-invoicing-client.ts) no
      // quedan en el XML local -- si el rechazo original fue por falta de esos datos, corregir el
      // Customer y reintentar aqui NO alcanza, hay que generar la factura de nuevo desde la venta.
      const extracted = extractUblDocument(invoice.xmlContent);
      const token = decryptCredential(company.matiasApiTokenEncrypted, env.CREDENTIALS_ENCRYPTION_KEY);
      const result = await this.thirdPartyClient.submitInvoice(token, {
        resolutionNumber: invoice.resolutionNumber,
        prefix: invoice.prefix,
        documentNumber: invoice.number,
        issueDate: invoice.issueDate,
        subtotal: Number(extracted.subtotal ?? 0),
        taxTotal: Number(extracted.taxAmount ?? 0),
        total: Number(extracted.total ?? 0),
        customer: {
          documentType: extracted.customer.documentType ?? "",
          documentNumber: extracted.customer.documentNumber,
          name: extracted.customer.name,
          email: null,
          phone: null,
          address: null,
          postalCode: null,
          countryId: null,
          cityId: null,
          identityDocumentId: null,
          typeOrganizationId: null,
          taxRegimeId: null,
          taxLevelId: null,
        },
        lines: extracted.lines.map((line) => ({
          description: line.description,
          code: "ITEM",
          quantity: Number(line.quantity ?? 1),
          unitPrice: Number(line.unitPrice ?? 0),
          taxPercent: 0,
          taxAmount: 0,
          lineTotal: Number(line.total),
        })),
      });
      await this.invoiceRepo.applyThirdPartySubmissionResult(invoice.id, result);
      return;
    }

    if (!env.DIAN_CERTIFICATE_PATH) {
      throw new ValidationError("No hay un certificado DIAN configurado (DIAN_CERTIFICATE_PATH)");
    }

    await signAndQueueElectronicDocument({
      certificateLoader: this.certificateLoader,
      xmlSigner: this.xmlSigner,
      submissionRepo: this.invoiceRepo,
      audit: this.audit,
      certificatePath: env.DIAN_CERTIFICATE_PATH,
      certificatePassword: env.DIAN_CERTIFICATE_PASSWORD,
      documentId: invoice.id,
      entityType,
      sourceEntityId: entityId,
      fullNumber: invoice.fullNumber,
      unsignedXml: invoice.xmlContent,
      signingFailedAction: "ELECTRONIC_INVOICE_SIGNING_FAILED",
      documentLabel: "la factura electronica",
    });
  }
}
