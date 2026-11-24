import { env } from "../../../../config/env";
import { ConflictError, NotFoundError, ValidationError } from "../../../../shared/errors/app-error";
import type { AuditService } from "../../../audit/application/audit.service";
import type { ICertificateLoader } from "../../domain/certificate-loader";
import type { IElectronicPayrollRepository } from "../../domain/electronic-payroll.repository";
import type { IXmlSigner } from "../../domain/xml-signer";
import type { ICompanyReader } from "../../domain/company-reader.repository";
import type { IThirdPartyInvoicingClient, ThirdPartyPayrollInput } from "../../domain/third-party-invoicing-client";
import { getTenantContext } from "../../../../shared/context/request-context";
import { resubmitThirdPartyDocument } from "../resubmit-third-party-document";
import { parseProviderRequest } from "../submit-third-party-document";
import { signAndQueueElectronicDocument } from "../sign-and-queue-electronic-document";

/** Analogo a ResubmitElectronicCreditNoteUseCase, para nomina electronica. */
export class ResubmitElectronicPayrollUseCase {
  constructor(
    private readonly payrollRepo: IElectronicPayrollRepository,
    private readonly certificateLoader: ICertificateLoader,
    private readonly xmlSigner: IXmlSigner,
    private readonly audit: AuditService,
    private readonly companyReader: ICompanyReader,
    private readonly providerClient: IThirdPartyInvoicingClient
  ) {}

  async execute(payrollDetailId: string): Promise<void> {
    const company = await this.companyReader.findByIdOrThrow(getTenantContext().companyId);
    if (company.electronicInvoicingProvider === "FACTUS") {
      const found = await this.payrollRepo.findByPayrollDetailId(payrollDetailId);
      if (!found) throw new NotFoundError("Nomina electronica", payrollDetailId);
      await resubmitThirdPartyDocument({
        company,
        document: found,
        submit: (credentials, raw) => this.providerClient.submitPayroll(credentials, parseProviderRequest<ThirdPartyPayrollInput>(raw, ["issueDate"], ["paymentDates"])),
        apply: (result) => this.payrollRepo.applyThirdPartyResult(found.id, result),
        audit: this.audit,
        entityType: "PayrollDetail",
        entityId: payrollDetailId,
        label: "Nomina electronica",
        failedAction: "ELECTRONIC_PAYROLL_GENERATION_FAILED",
      });
      return;
    }
    if (!env.DIAN_CERTIFICATE_PATH) {
      throw new ValidationError("No hay un certificado DIAN configurado (DIAN_CERTIFICATE_PATH)");
    }

    const doc = await this.payrollRepo.findByPayrollDetailId(payrollDetailId);
    if (!doc) throw new NotFoundError("ElectronicPayroll", payrollDetailId);

    if (doc.status === "ACCEPTED" || doc.status === "PENDING_SUBMISSION") {
      throw new ConflictError(`La nomina electronica ${doc.fullNumber} ya esta ${doc.status.toLowerCase()}, nada que reenviar`);
    }

    await signAndQueueElectronicDocument({
      certificateLoader: this.certificateLoader,
      xmlSigner: this.xmlSigner,
      submissionRepo: this.payrollRepo,
      audit: this.audit,
      certificatePath: env.DIAN_CERTIFICATE_PATH,
      certificatePassword: env.DIAN_CERTIFICATE_PASSWORD,
      documentId: doc.id,
      entityType: "PayrollDetail",
      sourceEntityId: doc.payrollDetailId,
      fullNumber: doc.fullNumber,
      unsignedXml: doc.xmlContent,
      signingFailedAction: "ELECTRONIC_PAYROLL_SIGNING_FAILED",
      documentLabel: "la nomina electronica",
    });
  }
}
