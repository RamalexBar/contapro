import { env } from "../../../../config/env";
import { getTenantContext } from "../../../../shared/context/request-context";
import { ValidationError } from "../../../../shared/errors/app-error";
import type { AuditService } from "../../../audit/application/audit.service";
import type { ICustomerRepository } from "../../../customers/domain/customer.repository";
import type { ICertificateLoader } from "../../domain/certificate-loader";
import type { ICompanyReader } from "../../domain/company-reader.repository";
import type { ElectronicDebitNoteRecord, IElectronicDebitNoteRepository } from "../../domain/electronic-debit-note.repository";
import type { IElectronicInvoiceRepository } from "../../domain/electronic-invoice.repository";
import type { IXmlSigner } from "../../domain/xml-signer";
import { DIAN_GENERIC_FINAL_CONSUMER, DIAN_NOTE_TYPE_CODE } from "../constants";
import { generateCude } from "../cude-generator";
import { signAndQueueElectronicDocument } from "../sign-and-queue-electronic-document";
import { buildUblNoteXml } from "../ubl-note-xml-builder";

export interface GenerateElectronicDebitNoteInput {
  debitNoteId: string;
  branchId: string;
  customerId: string | null;
  saleId: string | null;
  issueDate: Date;
  amount: number;
  reason: string;
}

/** Analogo a GenerateElectronicCreditNoteUseCase, para notas debito. */
export class GenerateElectronicDebitNoteUseCase {
  constructor(
    private readonly debitNoteRepo: IElectronicDebitNoteRepository,
    private readonly invoiceRepo: IElectronicInvoiceRepository,
    private readonly companyReader: ICompanyReader,
    private readonly customerRepo: ICustomerRepository,
    private readonly audit: AuditService,
    private readonly certificateLoader: ICertificateLoader,
    private readonly xmlSigner: IXmlSigner
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
    const customer = input.customerId ? await this.customerRepo.findByIdOrThrow(input.customerId) : null;

    const buyer = customer
      ? { documentType: customer.documentType, documentNumber: customer.documentNumber, name: customer.name }
      : DIAN_GENERIC_FINAL_CONSUMER;

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
        taxAmount: 0,
        reason: input.reason,
        referenceCufe: referencedInvoice.cufe,
        environment: env.DIAN_ENVIRONMENT,
      },
      (fullNumber) => {
        const cude = generateCude({
          fullNumber,
          issueDate: input.issueDate,
          amount: input.amount,
          taxAmount: 0,
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
          taxAmount: 0,
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
      description: `Nota debito electronica generada localmente: ${note.fullNumber} (CUDE ${note.cude.slice(0, 12)}...)`,
      metadata: { fullNumber: note.fullNumber, cude: note.cude, referenceCufe: referencedInvoice.cufe },
    });

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
