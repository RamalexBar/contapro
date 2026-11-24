import { env } from "../../../../config/env";
import { getTenantContext } from "../../../../shared/context/request-context";
import { ValidationError } from "../../../../shared/errors/app-error";
import type { AuditService } from "../../../audit/application/audit.service";
import type { ICustomerRepository } from "../../../customers/domain/customer.repository";
import type { ICertificateLoader } from "../../domain/certificate-loader";
import type { ICompanyReader } from "../../domain/company-reader.repository";
import type { ElectronicCreditNoteRecord, IElectronicCreditNoteRepository } from "../../domain/electronic-credit-note.repository";
import type { IElectronicInvoiceRepository } from "../../domain/electronic-invoice.repository";
import type { IThirdPartyInvoicingClient, ThirdPartyDocumentLineInput, ThirdPartyNoteInput } from "../../domain/third-party-invoicing-client";
import type { IXmlSigner } from "../../domain/xml-signer";
import { DIAN_NOTE_TYPE_CODE, type CreditNoteConceptCode } from "../constants";
import { generateCude } from "../cude-generator";
import { signAndQueueElectronicDocument } from "../sign-and-queue-electronic-document";
import { serializeProviderRequest, submitThirdPartyDocument } from "../submit-third-party-document";
import { buyerOf, toThirdPartyCustomer } from "../third-party-customer";
import { buildUblNoteXml } from "../ubl-note-xml-builder";

export interface GenerateElectronicCreditNoteInput {
  creditNoteId: string;
  branchId: string;
  customerId: string | null;
  saleId: string | null;
  issueDate: Date;
  /** Valor total de la nota, con impuestos. */
  amount: number;
  reason: string;
  conceptCode: CreditNoteConceptCode;
  /** Renglones con su tarifa (devolucion: los productos devueltos; nota libre: ver noteLinesFromAmount). */
  lines: ThirdPartyDocumentLineInput[];
  /** Medio de pago DIAN de la devolucion del dinero (10 efectivo, 47 transferencia...). */
  paymentMethodCode?: string;
}

/**
 * Nota credito electronica: siempre referencia la factura de la venta (la DIAN no admite una nota
 * credito suelta en este flujo). Lanza si la venta no tiene factura; el llamador
 * (CreateCreditNoteUseCase) lo atrapa y audita, igual que create-sale.use-case.ts con la factura.
 *
 * - Empresa con FACTUS: la factura tuvo que quedar ACCEPTED por Factus (se referencia por el numero
 *   legal que Factus le dio). Factus numera, firma y transmite la nota; el consecutivo interno de
 *   Contapro queda reemplazado por el suyo. Verificado en el sandbox el 2026-11-24.
 * - Envio directo: XML UBL propio firmado con el certificado, sin verificar contra la DIAN real.
 */
export class GenerateElectronicCreditNoteUseCase {
  constructor(
    private readonly creditNoteRepo: IElectronicCreditNoteRepository,
    private readonly invoiceRepo: IElectronicInvoiceRepository,
    private readonly companyReader: ICompanyReader,
    private readonly customerRepo: ICustomerRepository,
    private readonly audit: AuditService,
    private readonly certificateLoader: ICertificateLoader,
    private readonly xmlSigner: IXmlSigner,
    private readonly providerClient: IThirdPartyInvoicingClient
  ) {}

  async execute(input: GenerateElectronicCreditNoteInput): Promise<ElectronicCreditNoteRecord> {
    if (!input.saleId) {
      throw new ValidationError("La nota credito no referencia una venta, no se puede generar CUDE");
    }

    const referencedInvoice = await this.invoiceRepo.findBySaleId(input.saleId);
    if (!referencedInvoice) {
      throw new ValidationError("La venta referenciada por la nota credito aun no tiene factura electronica");
    }

    const ctx = getTenantContext();
    const company = await this.companyReader.findByIdOrThrow(ctx.companyId);
    const viaThirdParty = company.electronicInvoicingProvider === "FACTUS";
    if (viaThirdParty && (referencedInvoice.status !== "ACCEPTED" || !referencedInvoice.providerNumber)) {
      throw new ValidationError(
        `La factura ${referencedInvoice.fullNumber} de esta venta no esta autorizada por Factus (estado ${referencedInvoice.status}): reenviela antes de emitir la nota credito`
      );
    }

    const customer = input.customerId ? await this.customerRepo.findByIdOrThrow(input.customerId) : null;
    const buyer = buyerOf(customer);
    const taxAmount = Math.round(input.lines.reduce((s, l) => s + l.quantity * l.unitPrice * (1 - (l.discountPercent ?? 0) / 100) * (l.taxPercent / 100), 0) * 100) / 100;

    let generatedXmlContent = "";
    const note = await this.creditNoteRepo.claimNumberAndGenerate(
      {
        creditNoteId: input.creditNoteId,
        branchId: input.branchId,
        issueDate: input.issueDate,
        customerDocumentType: buyer.documentType,
        customerDocumentNumber: buyer.documentNumber,
        customerName: buyer.name,
        amount: input.amount,
        taxAmount,
        reason: input.reason,
        referenceCufe: referencedInvoice.cufe,
        environment: env.DIAN_ENVIRONMENT,
        viaThirdParty,
      },
      (fullNumber) => {
        // Con Factus este CUDE y XML son provisionales: los reemplazan los reales del proveedor.
        const cude = generateCude({
          fullNumber,
          issueDate: input.issueDate,
          amount: input.amount,
          taxAmount,
          issuerNit: company.nit.replace(/\D/g, ""),
          buyerDocumentNumber: buyer.documentNumber,
          technicalKey: env.DIAN_TECHNICAL_KEY,
          environment: env.DIAN_ENVIRONMENT,
          noteTypeCode: DIAN_NOTE_TYPE_CODE.CREDIT,
          referenceCufe: referencedInvoice.cufe,
        });
        const xmlContent = buildUblNoteXml("CREDIT", {
          fullNumber,
          cude,
          referenceCufe: referencedInvoice.cufe,
          issueDate: input.issueDate,
          environment: env.DIAN_ENVIRONMENT,
          issuer: { nit: company.nit, legalName: company.legalName },
          buyer,
          amount: input.amount,
          taxAmount,
          reason: input.reason,
        });
        generatedXmlContent = xmlContent;
        return { cude, xmlContent };
      }
    );

    await this.audit.record({
      action: "ELECTRONIC_CREDIT_NOTE_GENERATED",
      entityType: "CreditNote",
      entityId: input.creditNoteId,
      description: `Nota credito electronica generada: ${note.fullNumber}`,
      metadata: { fullNumber: note.fullNumber, referenceCufe: referencedInvoice.cufe },
    });

    if (viaThirdParty) {
      const request: ThirdPartyNoteInput = {
        kind: "CREDIT",
        referenceCode: `${note.fullNumber}-${input.issueDate.getTime().toString(36)}`,
        billNumber: referencedInvoice.providerNumber!,
        conceptCode: input.conceptCode,
        issueDate: input.issueDate,
        observation: input.reason,
        customer: toThirdPartyCustomer(buyer, customer),
        lines: input.lines,
        total: input.amount,
        paymentMethodCode: input.paymentMethodCode,
      };
      await this.creditNoteRepo.saveProviderRequest(note.id, serializeProviderRequest(request));
      const result = await submitThirdPartyDocument({
        encryptedCredential: company.factusCredentialsEncrypted,
        submit: (credentials) => this.providerClient.submitNote(credentials, request),
        apply: (r) => this.creditNoteRepo.applyThirdPartyResult(note.id, r),
        audit: this.audit,
        entityType: "CreditNote",
        entityId: input.creditNoteId,
        label: "Nota credito",
        internalNumber: note.fullNumber,
        failedAction: "ELECTRONIC_CREDIT_NOTE_GENERATION_FAILED",
      });
      if (result?.status === "ACCEPTED") {
        return { ...note, fullNumber: result.number, cude: result.uniqueCode, status: "ACCEPTED" };
      }
      if (result?.status === "REJECTED") return { ...note, status: "REJECTED" };
      return note;
    }

    if (env.DIAN_CERTIFICATE_PATH) {
      await signAndQueueElectronicDocument({
        certificateLoader: this.certificateLoader,
        xmlSigner: this.xmlSigner,
        submissionRepo: this.creditNoteRepo,
        audit: this.audit,
        certificatePath: env.DIAN_CERTIFICATE_PATH,
        certificatePassword: env.DIAN_CERTIFICATE_PASSWORD,
        documentId: note.id,
        entityType: "CreditNote",
        sourceEntityId: input.creditNoteId,
        fullNumber: note.fullNumber,
        unsignedXml: generatedXmlContent,
        signingFailedAction: "ELECTRONIC_CREDIT_NOTE_SIGNING_FAILED",
        documentLabel: "la nota credito electronica",
      });
    }

    return note;
  }
}
