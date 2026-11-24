import { env } from "../../../../config/env";
import { getTenantContext } from "../../../../shared/context/request-context";
import { ValidationError } from "../../../../shared/errors/app-error";
import type { AuditService } from "../../../audit/application/audit.service";
import type { ICustomerRepository } from "../../../customers/domain/customer.repository";
import type { ICertificateLoader } from "../../domain/certificate-loader";
import type { ICompanyReader } from "../../domain/company-reader.repository";
import type { ElectronicDebitNoteRecord, IElectronicDebitNoteRepository } from "../../domain/electronic-debit-note.repository";
import type { IElectronicInvoiceRepository } from "../../domain/electronic-invoice.repository";
import type { IThirdPartyInvoicingClient, ThirdPartyDocumentLineInput, ThirdPartyNoteInput } from "../../domain/third-party-invoicing-client";
import type { IXmlSigner } from "../../domain/xml-signer";
import { DIAN_NOTE_TYPE_CODE, type DebitNoteConceptCode } from "../constants";
import { generateCude } from "../cude-generator";
import { signAndQueueElectronicDocument } from "../sign-and-queue-electronic-document";
import { serializeProviderRequest, submitThirdPartyDocument } from "../submit-third-party-document";
import { buyerOf, toThirdPartyCustomer } from "../third-party-customer";
import { buildUblNoteXml } from "../ubl-note-xml-builder";

export interface GenerateElectronicDebitNoteInput {
  debitNoteId: string;
  branchId: string;
  customerId: string | null;
  saleId: string | null;
  issueDate: Date;
  /** Valor total de la nota, con impuestos. */
  amount: number;
  reason: string;
  conceptCode: DebitNoteConceptCode;
  lines: ThirdPartyDocumentLineInput[];
}

/** Analogo a GenerateElectronicCreditNoteUseCase, para notas debito (cobros adicionales sobre una factura). */
export class GenerateElectronicDebitNoteUseCase {
  constructor(
    private readonly debitNoteRepo: IElectronicDebitNoteRepository,
    private readonly invoiceRepo: IElectronicInvoiceRepository,
    private readonly companyReader: ICompanyReader,
    private readonly customerRepo: ICustomerRepository,
    private readonly audit: AuditService,
    private readonly certificateLoader: ICertificateLoader,
    private readonly xmlSigner: IXmlSigner,
    private readonly providerClient: IThirdPartyInvoicingClient
  ) {}

  async execute(input: GenerateElectronicDebitNoteInput): Promise<ElectronicDebitNoteRecord> {
    if (!input.saleId) {
      throw new ValidationError("La nota debito no referencia una venta, no se puede generar CUDE");
    }

    const referencedInvoice = await this.invoiceRepo.findBySaleId(input.saleId);
    if (!referencedInvoice) {
      throw new ValidationError("La venta referenciada por la nota debito aun no tiene factura electronica");
    }

    const ctx = getTenantContext();
    const company = await this.companyReader.findByIdOrThrow(ctx.companyId);
    const viaThirdParty = company.electronicInvoicingProvider === "FACTUS";
    if (viaThirdParty && (referencedInvoice.status !== "ACCEPTED" || !referencedInvoice.providerNumber)) {
      throw new ValidationError(
        `La factura ${referencedInvoice.fullNumber} de esta venta no esta autorizada por Factus (estado ${referencedInvoice.status}): reenviela antes de emitir la nota debito`
      );
    }

    const customer = input.customerId ? await this.customerRepo.findByIdOrThrow(input.customerId) : null;
    const buyer = buyerOf(customer);
    const taxAmount = Math.round(input.lines.reduce((s, l) => s + l.quantity * l.unitPrice * (1 - (l.discountPercent ?? 0) / 100) * (l.taxPercent / 100), 0) * 100) / 100;

    let generatedXmlContent = "";
    const note = await this.debitNoteRepo.claimNumberAndGenerate(
      {
        debitNoteId: input.debitNoteId,
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
        const cude = generateCude({
          fullNumber,
          issueDate: input.issueDate,
          amount: input.amount,
          taxAmount,
          issuerNit: company.nit.replace(/\D/g, ""),
          buyerDocumentNumber: buyer.documentNumber,
          technicalKey: env.DIAN_TECHNICAL_KEY,
          environment: env.DIAN_ENVIRONMENT,
          noteTypeCode: DIAN_NOTE_TYPE_CODE.DEBIT,
          referenceCufe: referencedInvoice.cufe,
        });
        const xmlContent = buildUblNoteXml("DEBIT", {
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
      action: "ELECTRONIC_DEBIT_NOTE_GENERATED",
      entityType: "DebitNote",
      entityId: input.debitNoteId,
      description: `Nota debito electronica generada: ${note.fullNumber}`,
      metadata: { fullNumber: note.fullNumber, referenceCufe: referencedInvoice.cufe },
    });

    if (viaThirdParty) {
      const request: ThirdPartyNoteInput = {
        kind: "DEBIT",
        referenceCode: `${note.fullNumber}-${input.issueDate.getTime().toString(36)}`,
        billNumber: referencedInvoice.providerNumber!,
        conceptCode: input.conceptCode,
        issueDate: input.issueDate,
        observation: input.reason,
        customer: toThirdPartyCustomer(buyer, customer),
        lines: input.lines,
        total: input.amount,
      };
      await this.debitNoteRepo.saveProviderRequest(note.id, serializeProviderRequest(request));
      const result = await submitThirdPartyDocument({
        encryptedCredential: company.factusCredentialsEncrypted,
        submit: (credentials) => this.providerClient.submitNote(credentials, request),
        apply: (r) => this.debitNoteRepo.applyThirdPartyResult(note.id, r),
        audit: this.audit,
        entityType: "DebitNote",
        entityId: input.debitNoteId,
        label: "Nota debito",
        internalNumber: note.fullNumber,
        failedAction: "ELECTRONIC_DEBIT_NOTE_GENERATION_FAILED",
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
        submissionRepo: this.debitNoteRepo,
        audit: this.audit,
        certificatePath: env.DIAN_CERTIFICATE_PATH,
        certificatePassword: env.DIAN_CERTIFICATE_PASSWORD,
        documentId: note.id,
        entityType: "DebitNote",
        sourceEntityId: input.debitNoteId,
        fullNumber: note.fullNumber,
        unsignedXml: generatedXmlContent,
        signingFailedAction: "ELECTRONIC_DEBIT_NOTE_SIGNING_FAILED",
        documentLabel: "la nota debito electronica",
      });
    }

    return note;
  }
}
