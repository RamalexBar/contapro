import { env } from "../../../../config/env";
import { getTenantContext } from "../../../../shared/context/request-context";
import type { AuditService } from "../../../audit/application/audit.service";
import type { ISupplierRepository } from "../../../suppliers/domain/supplier.repository";
import type { ICertificateLoader } from "../../domain/certificate-loader";
import type { ICompanyReader } from "../../domain/company-reader.repository";
import type {
  ElectronicSupportDocumentRecord,
  IElectronicSupportDocumentRepository,
} from "../../domain/electronic-support-document.repository";
import type {
  IThirdPartyInvoicingClient,
  ThirdPartyDocumentLineInput,
  ThirdPartySupportDocumentInput,
  ThirdPartyWithholdingInput,
} from "../../domain/third-party-invoicing-client";
import type { IXmlSigner } from "../../domain/xml-signer";
import { generateCuds } from "../cuds-generator";
import { signAndQueueElectronicDocument } from "../sign-and-queue-electronic-document";
import { serializeProviderRequest, submitThirdPartyDocument } from "../submit-third-party-document";
import { buildUblSupportDocumentXml } from "../ubl-support-document-xml-builder";

export interface GenerateElectronicSupportDocumentInput {
  purchaseId: string;
  branchId: string;
  supplierId: string;
  issueDate: Date;
  subtotal: number;
  taxTotal: number;
  total: number;
  /** Numero del soporte del proveedor (cuenta de cobro, recibo), va como observacion. */
  supplierReference: string;
  lines: ThirdPartyDocumentLineInput[];
  withholdings: ThirdPartyWithholdingInput[];
  /** Vencimiento de la cuenta por pagar: la compra queda a credito hasta pagarla. */
  dueDate: Date | null;
}

/**
 * Documento soporte en adquisiciones a no obligados a facturar: lo expide la empresa compradora.
 *
 * - Empresa con FACTUS: Factus numera (con el rango de documento soporte de la cuenta, que si
 *   lleva resolucion DIAN), firma y transmite. Verificado en el sandbox el 2026-11-24.
 * - Envio directo: XML propio (placeholder, la parte menos verificada del modulo, ver README).
 */
export class GenerateElectronicSupportDocumentUseCase {
  constructor(
    private readonly supportDocumentRepo: IElectronicSupportDocumentRepository,
    private readonly companyReader: ICompanyReader,
    private readonly supplierRepo: ISupplierRepository,
    private readonly audit: AuditService,
    private readonly certificateLoader: ICertificateLoader,
    private readonly xmlSigner: IXmlSigner,
    private readonly providerClient: IThirdPartyInvoicingClient
  ) {}

  async execute(input: GenerateElectronicSupportDocumentInput): Promise<ElectronicSupportDocumentRecord> {
    const ctx = getTenantContext();
    const company = await this.companyReader.findByIdOrThrow(ctx.companyId);
    const supplier = await this.supplierRepo.findByIdOrThrow(input.supplierId);
    const viaThirdParty = company.electronicInvoicingProvider === "FACTUS";
    const supplierDocumentType = supplier.documentType || "NIT";

    let generatedXmlContent = "";
    const doc = await this.supportDocumentRepo.claimNumberAndGenerate(
      {
        purchaseId: input.purchaseId,
        branchId: input.branchId,
        issueDate: input.issueDate,
        supplierDocumentType,
        supplierDocumentNumber: supplier.nit,
        supplierName: supplier.name,
        subtotal: input.subtotal,
        taxTotal: input.taxTotal,
        total: input.total,
        environment: env.DIAN_ENVIRONMENT,
        viaThirdParty,
      },
      (fullNumber) => {
        const cuds = generateCuds({
          fullNumber,
          issueDate: input.issueDate,
          subtotal: input.subtotal,
          taxAmount: input.taxTotal,
          total: input.total,
          issuerNit: company.nit.replace(/\D/g, ""),
          supplierDocumentNumber: supplier.nit,
          technicalKey: env.DIAN_TECHNICAL_KEY,
          environment: env.DIAN_ENVIRONMENT,
        });
        const xmlContent = buildUblSupportDocumentXml({
          fullNumber,
          cuds,
          issueDate: input.issueDate,
          environment: env.DIAN_ENVIRONMENT,
          issuer: { nit: company.nit, legalName: company.legalName },
          supplier: { documentType: supplierDocumentType, documentNumber: supplier.nit, name: supplier.name },
          subtotal: input.subtotal,
          taxTotal: input.taxTotal,
          total: input.total,
        });
        generatedXmlContent = xmlContent;
        return { cuds, xmlContent };
      }
    );

    await this.audit.record({
      action: "ELECTRONIC_SUPPORT_DOCUMENT_GENERATED",
      entityType: "Purchase",
      entityId: input.purchaseId,
      description: `Documento soporte electronico generado: ${doc.fullNumber}`,
      metadata: { fullNumber: doc.fullNumber },
    });

    if (viaThirdParty) {
      const request: ThirdPartySupportDocumentInput = {
        referenceCode: `${doc.fullNumber}-${input.issueDate.getTime().toString(36)}`,
        issueDate: input.issueDate,
        observation: `Soporte del proveedor: ${input.supplierReference}`,
        provider: {
          documentType: supplierDocumentType,
          documentNumber: supplier.nit,
          name: supplier.name,
          address: supplier.address,
          email: supplier.email,
          phone: supplier.phone,
          municipalityCode: supplier.municipalityCode,
        },
        lines: input.lines,
        total: input.total,
        withholdings: input.withholdings,
        creditAmount: input.dueDate ? input.total : 0,
        dueDate: input.dueDate,
      };
      await this.supportDocumentRepo.saveProviderRequest(doc.id, serializeProviderRequest(request));
      const result = await submitThirdPartyDocument({
        encryptedCredential: company.factusCredentialsEncrypted,
        submit: (credentials) => this.providerClient.submitSupportDocument(credentials, request),
        apply: (r) => this.supportDocumentRepo.applyThirdPartyResult(doc.id, r),
        audit: this.audit,
        entityType: "Purchase",
        entityId: input.purchaseId,
        label: "Documento soporte",
        internalNumber: doc.fullNumber,
        failedAction: "ELECTRONIC_SUPPORT_DOCUMENT_GENERATION_FAILED",
      });
      if (result?.status === "ACCEPTED") {
        return { ...doc, fullNumber: result.number, cuds: result.uniqueCode, status: "ACCEPTED" };
      }
      if (result?.status === "REJECTED") return { ...doc, status: "REJECTED" };
      return doc;
    }

    if (env.DIAN_CERTIFICATE_PATH) {
      await signAndQueueElectronicDocument({
        certificateLoader: this.certificateLoader,
        xmlSigner: this.xmlSigner,
        submissionRepo: this.supportDocumentRepo,
        audit: this.audit,
        certificatePath: env.DIAN_CERTIFICATE_PATH,
        certificatePassword: env.DIAN_CERTIFICATE_PASSWORD,
        documentId: doc.id,
        entityType: "Purchase",
        sourceEntityId: input.purchaseId,
        fullNumber: doc.fullNumber,
        unsignedXml: generatedXmlContent,
        signingFailedAction: "ELECTRONIC_SUPPORT_DOCUMENT_SIGNING_FAILED",
        documentLabel: "el documento soporte electronico",
      });
    }

    return doc;
  }
}
