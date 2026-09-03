import { env } from "../../../../config/env";
import { getTenantContext } from "../../../../shared/context/request-context";
import { decryptCredential } from "../../../../shared/crypto/credential-cipher";
import type { AuditService } from "../../../audit/application/audit.service";
import type { ICustomerRepository } from "../../../customers/domain/customer.repository";
import type { ICertificateLoader } from "../../domain/certificate-loader";
import type { ICompanyReader } from "../../domain/company-reader.repository";
import type { ElectronicInvoiceRecord, ElectronicInvoiceSource, IElectronicInvoiceRepository } from "../../domain/electronic-invoice.repository";
import type { IThirdPartyInvoicingClient } from "../../domain/third-party-invoicing-client";
import type { IXmlSigner } from "../../domain/xml-signer";
import { DIAN_GENERIC_FINAL_CONSUMER } from "../constants";
import { generateCufe } from "../cufe-generator";
import { signAndQueueElectronicDocument } from "../sign-and-queue-electronic-document";
import { buildUblInvoiceXml } from "../ubl-invoice-xml-builder";

export interface GenerateElectronicInvoiceItemInput {
  description: string;
  quantity: number;
  unitPrice: number;
  taxPercent: number;
  taxAmount: number;
  total: number;
}

export interface GenerateElectronicInvoiceWithholdingInput {
  type: "RETEFUENTE" | "RETEICA" | "RETEIVA";
  base: number;
  ratePercent: number;
  amount: number;
}

export interface GenerateElectronicInvoiceInput {
  source: ElectronicInvoiceSource;
  branchId: string;
  customerId: string | null;
  issueDate: Date;
  subtotal: number;
  taxTotal: number;
  total: number;
  items: GenerateElectronicInvoiceItemInput[];
  withholdingTaxes: GenerateElectronicInvoiceWithholdingInput[];
  // Multi-moneda informativa (item 33 de docs/ALCANCE.md) -- ver ubl-invoice-xml-builder.ts.
  currency?: string;
}

export class GenerateElectronicInvoiceUseCase {
  constructor(
    private readonly invoiceRepo: IElectronicInvoiceRepository,
    private readonly companyReader: ICompanyReader,
    private readonly customerRepo: ICustomerRepository,
    private readonly audit: AuditService,
    private readonly certificateLoader: ICertificateLoader,
    private readonly xmlSigner: IXmlSigner,
    private readonly thirdPartyClient: IThirdPartyInvoicingClient
  ) {}

  async execute(input: GenerateElectronicInvoiceInput): Promise<ElectronicInvoiceRecord> {
    const ctx = getTenantContext();
    const company = await this.companyReader.findByIdOrThrow(ctx.companyId);
    const customer = input.customerId ? await this.customerRepo.findByIdOrThrow(input.customerId) : null;

    // Discriminador de la entidad fuente -- reusado en cada auditoria/llamada de firma de abajo
    // en vez de hardcodear "Sale" (ver ElectronicInvoiceSource en domain/electronic-invoice.repository.ts).
    const entityType = input.source.type === "sale" ? "Sale" : "ManualInvoice";
    const entityId = input.source.type === "sale" ? input.source.saleId : input.source.manualInvoiceId;

    const buyer = customer
      ? { documentType: customer.documentType, documentNumber: customer.documentNumber, name: customer.name }
      : DIAN_GENERIC_FINAL_CONSUMER;

    let generatedXmlContent = "";

    const invoice = await this.invoiceRepo.claimNumberAndGenerate(
      {
        source: input.source,
        branchId: input.branchId,
        issueDate: input.issueDate,
        customerDocumentType: buyer.documentType,
        customerDocumentNumber: buyer.documentNumber,
        customerName: buyer.name,
        subtotal: input.subtotal,
        taxTotal: input.taxTotal,
        total: input.total,
        environment: env.DIAN_ENVIRONMENT,
      },
      (fullNumber) => {
        // Solo ICA participa en la formula del CUFE (ValImp3, codigo "03") segun el Anexo
        // Tecnico -- ReteFuente/ReteIVA no tienen slot ahi, se quedan fuera a proposito. Este
        // valor viene de la venta real desde la iteracion de retenciones (antes iba fijo en 0);
        // sigue sin verificarse contra el servicio real de la DIAN, mismo aviso que el resto de
        // este calculo (ver README del modulo).
        const icaAmount = input.withholdingTaxes.find((w) => w.type === "RETEICA")?.amount ?? 0;

        const cufe = generateCufe({
          fullNumber,
          issueDate: input.issueDate,
          subtotal: input.subtotal,
          ivaAmount: input.taxTotal,
          consumptionTaxAmount: 0,
          icaAmount,
          total: input.total,
          issuerNit: company.nit.replace(/\D/g, ""),
          buyerDocumentNumber: buyer.documentNumber,
          technicalKey: env.DIAN_TECHNICAL_KEY,
          environment: env.DIAN_ENVIRONMENT,
        });

        const xmlContent = buildUblInvoiceXml({
          fullNumber,
          cufe,
          issueDate: input.issueDate,
          environment: env.DIAN_ENVIRONMENT,
          issuer: { nit: company.nit, legalName: company.legalName },
          buyer,
          subtotal: input.subtotal,
          taxTotal: input.taxTotal,
          total: input.total,
          currency: input.currency,
          items: input.items,
          withholdingTaxes: input.withholdingTaxes.map((w) => ({
            type: w.type,
            base: w.base,
            percent: w.ratePercent,
            amount: w.amount,
          })),
        });

        generatedXmlContent = xmlContent;
        return { cufe, xmlContent };
      }
    );

    await this.audit.record({
      action: "ELECTRONIC_INVOICE_GENERATED",
      entityType,
      entityId,
      description: `Factura electronica generada localmente: ${invoice.fullNumber} (CUFE ${invoice.cufe.slice(0, 12)}...)`,
      metadata: { fullNumber: invoice.fullNumber, cufe: invoice.cufe },
    });

    if (company.electronicInvoicingProvider === "MATIAS") {
      // Deliberadamente FUERA de la transaccion de claimNumberAndGenerate (ver aviso en
      // domain/third-party-invoicing-client.ts): una llamada de red ahi dejaria la transaccion de
      // Postgres abierta durante todo el round-trip. El CUFE/xmlContent locales de arriba son
      // provisionales -- applyThirdPartySubmissionResult los sobrescribe con los reales de MATIAS.
      await this.submitViaThirdPartyProvider(invoice, input, buyer, customer, company.matiasApiTokenEncrypted, entityType, entityId);
    } else if (env.DIAN_CERTIFICATE_PATH) {
      // No bloquea: si falla, la factura queda GENERATED (sin firmar), recuperable via el
      // endpoint de reenvio manual una vez se corrija el problema (ej. contraseña incorrecta).
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
        unsignedXml: generatedXmlContent,
        signingFailedAction: "ELECTRONIC_INVOICE_SIGNING_FAILED",
        documentLabel: "la factura electronica",
      });
    }

    return invoice;
  }

  /**
   * Ver README del modulo, seccion "Proveedor tecnologico (MATIAS API)". No bloquea la venta si
   * falla: la factura queda GENERATED con el CUFE local provisional, se audita, y el reenvio
   * manual (ResubmitElectronicInvoiceUseCase) reintenta -- mismo criterio que el resto del modulo.
   */
  private async submitViaThirdPartyProvider(
    invoice: ElectronicInvoiceRecord,
    input: GenerateElectronicInvoiceInput,
    buyer: { documentType: string; documentNumber: string; name: string },
    customer: Awaited<ReturnType<ICustomerRepository["findByIdOrThrow"]>> | null,
    encryptedToken: string | null,
    entityType: string,
    entityId: string
  ): Promise<void> {
    if (!encryptedToken) {
      await this.audit.record({
        action: "ELECTRONIC_INVOICE_GENERATION_FAILED",
        entityType,
        entityId,
        description: `Empresa configurada con proveedor MATIAS pero sin token cargado (${invoice.fullNumber})`,
      });
      return;
    }

    try {
      const token = decryptCredential(encryptedToken, env.CREDENTIALS_ENCRYPTION_KEY);
      const result = await this.thirdPartyClient.submitInvoice(token, {
        resolutionNumber: invoice.resolutionNumber,
        prefix: invoice.prefix,
        documentNumber: invoice.number,
        issueDate: input.issueDate,
        subtotal: input.subtotal,
        taxTotal: input.taxTotal,
        total: input.total,
        customer: {
          documentType: buyer.documentType,
          documentNumber: buyer.documentNumber,
          name: buyer.name,
          email: customer?.email ?? null,
          phone: customer?.phone ?? null,
          address: customer?.address ?? null,
          postalCode: customer?.dianPostalCode ?? null,
          countryId: customer?.dianCountryId ?? null,
          cityId: customer?.dianCityId ?? null,
          identityDocumentId: customer?.dianIdentityDocumentId ?? null,
          typeOrganizationId: customer?.dianTypeOrganizationId ?? null,
          taxRegimeId: customer?.dianTaxRegimeId ?? null,
          taxLevelId: customer?.dianTaxLevelId ?? null,
        },
        lines: input.items.map((item, i) => ({
          description: item.description,
          // Contapro no propaga un codigo de producto hasta este use-case todavia -- ver
          // README del modulo. Placeholder estable por posicion dentro de la factura.
          code: `ITEM-${i + 1}`,
          quantity: item.quantity,
          unitPrice: item.unitPrice,
          taxPercent: item.taxPercent,
          taxAmount: item.taxAmount,
          lineTotal: item.total,
        })),
      });

      await this.invoiceRepo.applyThirdPartySubmissionResult(invoice.id, result);
      await this.audit.record({
        action: result.status === "ACCEPTED" ? "ELECTRONIC_DOCUMENT_ACCEPTED" : "ELECTRONIC_DOCUMENT_REJECTED",
        entityType,
        entityId,
        description:
          result.status === "ACCEPTED"
            ? `Factura electronica autorizada via MATIAS: ${invoice.fullNumber} (CUFE ${result.cufe.slice(0, 12)}...)`
            : `Factura electronica rechazada por MATIAS: ${invoice.fullNumber} (${result.rejectionReason})`,
        metadata: { fullNumber: invoice.fullNumber, cufe: result.cufe || undefined, rejectionReason: result.rejectionReason },
      });
    } catch (err) {
      await this.audit.record({
        action: "ELECTRONIC_INVOICE_GENERATION_FAILED",
        entityType,
        entityId,
        description: `Fallo la llamada a MATIAS para ${invoice.fullNumber}: ${err instanceof Error ? err.message : String(err)}`,
      });
    }
  }
}
