import { env } from "../../../../config/env";
import { getTenantContext } from "../../../../shared/context/request-context";
import type { AuditService } from "../../../audit/application/audit.service";
import type { ICustomerRepository } from "../../../customers/domain/customer.repository";
import type { ICompanyReader } from "../../domain/company-reader.repository";
import type { ElectronicInvoiceRecord, IElectronicInvoiceRepository } from "../../domain/electronic-invoice.repository";
import { DIAN_GENERIC_FINAL_CONSUMER } from "../constants";
import { generateCufe } from "../cufe-generator";
import { buildUblInvoiceXml } from "../ubl-invoice-xml-builder";

export interface GenerateElectronicInvoiceItemInput {
  description: string;
  quantity: number;
  unitPrice: number;
  taxPercent: number;
  taxAmount: number;
  total: number;
}

export interface GenerateElectronicInvoiceInput {
  saleId: string;
  branchId: string;
  customerId: string | null;
  issueDate: Date;
  subtotal: number;
  taxTotal: number;
  total: number;
  items: GenerateElectronicInvoiceItemInput[];
}

export class GenerateElectronicInvoiceUseCase {
  constructor(
    private readonly invoiceRepo: IElectronicInvoiceRepository,
    private readonly companyReader: ICompanyReader,
    private readonly customerRepo: ICustomerRepository,
    private readonly audit: AuditService
  ) {}

  async execute(input: GenerateElectronicInvoiceInput): Promise<ElectronicInvoiceRecord> {
    const ctx = getTenantContext();
    const company = await this.companyReader.findByIdOrThrow(ctx.companyId);
    const customer = input.customerId ? await this.customerRepo.findByIdOrThrow(input.customerId) : null;

    const buyer = customer
      ? { documentType: customer.documentType, documentNumber: customer.documentNumber, name: customer.name }
      : DIAN_GENERIC_FINAL_CONSUMER;

    const invoice = await this.invoiceRepo.claimNumberAndGenerate(
      {
        saleId: input.saleId,
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
        const cufe = generateCufe({
          fullNumber,
          issueDate: input.issueDate,
          subtotal: input.subtotal,
          ivaAmount: input.taxTotal,
          consumptionTaxAmount: 0,
          icaAmount: 0,
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
          items: input.items,
        });

        return { cufe, xmlContent };
      }
    );

    await this.audit.record({
      action: "ELECTRONIC_INVOICE_GENERATED",
      entityType: "Sale",
      entityId: input.saleId,
      description: `Factura electronica generada localmente: ${invoice.fullNumber} (CUFE ${invoice.cufe.slice(0, 12)}...)`,
      metadata: { fullNumber: invoice.fullNumber, cufe: invoice.cufe },
    });

    return invoice;
  }
}
