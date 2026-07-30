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
import type { IXmlSigner } from "../../domain/xml-signer";
import { generateCuds } from "../cuds-generator";
import { signAndQueueElectronicDocument } from "../sign-and-queue-electronic-document";
import { buildUblSupportDocumentXml } from "../ubl-support-document-xml-builder";

export interface GenerateElectronicSupportDocumentInput {
  purchaseId: string;
  branchId: string;
  supplierId: string;
  issueDate: Date;
  subtotal: number;
  taxTotal: number;
  total: number;
}

/**
 * Analogo a GenerateElectronicCreditNoteUseCase, para documentos soporte. A diferencia de
 * facturas/notas, la contraparte (`supplier`) no tiene un `documentType` explicito en el modelo
 * actual (`Supplier` solo guarda `nit`) -- se asume "NIT" como simplificacion, igual criterio
 * que `DIAN_GENERIC_FINAL_CONSUMER` en constants.ts (un proveedor persona natural podria tener
 * cedula en vez de NIT; sin verificar, ver README del modulo).
 */
export class GenerateElectronicSupportDocumentUseCase {
  constructor(
    private readonly supportDocumentRepo: IElectronicSupportDocumentRepository,
    private readonly companyReader: ICompanyReader,
    private readonly supplierRepo: ISupplierRepository,
    private readonly audit: AuditService,
    private readonly certificateLoader: ICertificateLoader,
    private readonly xmlSigner: IXmlSigner
  ) {}

  async execute(input: GenerateElectronicSupportDocumentInput): Promise<ElectronicSupportDocumentRecord> {
    const ctx = getTenantContext();
    const company = await this.companyReader.findByIdOrThrow(ctx.companyId);
    const supplier = await this.supplierRepo.findByIdOrThrow(input.supplierId);

    let generatedXmlContent = "";

    const doc = await this.supportDocumentRepo.claimNumberAndGenerate(
      {
        purchaseId: input.purchaseId,
        branchId: input.branchId,
        issueDate: input.issueDate,
        supplierDocumentType: "NIT",
        supplierDocumentNumber: supplier.nit,
        supplierName: supplier.name,
        subtotal: input.subtotal,
        taxTotal: input.taxTotal,
        total: input.total,
        environment: env.DIAN_ENVIRONMENT,
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
          supplier: { documentType: "NIT", documentNumber: supplier.nit, name: supplier.name },
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
      description: `Documento soporte electronico generado localmente: ${doc.fullNumber} (CUDS ${doc.cuds.slice(0, 12)}...)`,
      metadata: { fullNumber: doc.fullNumber, cuds: doc.cuds },
    });

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
