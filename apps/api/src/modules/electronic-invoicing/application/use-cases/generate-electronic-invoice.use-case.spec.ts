import { describe, expect, it, vi } from "vitest";

// Stub obligatorio: generate-electronic-invoice.use-case.ts importa `env` (config/env.ts), que
// valida process.env al cargarse y lanza si falta DATABASE_URL/JWT_*. Sin este stub, este spec
// (el primero en value-importar un use-case de este modulo, el resto no tiene tests por el mismo
// motivo) fallaria en cualquier entorno sin un apps/api/.env real -- vi.mock se hoistea sobre los
// imports de abajo, asi que el modulo real nunca llega a evaluar la validacion de zod.
vi.mock("../../../../config/env", () => ({
  env: { DIAN_ENVIRONMENT: "HABILITACION", DIAN_TECHNICAL_KEY: "", DIAN_CERTIFICATE_PATH: "", DIAN_CERTIFICATE_PASSWORD: "", CREDENTIALS_ENCRYPTION_KEY: "" },
}));

import { tenantStorage } from "../../../../shared/context/request-context";
import { AuditService } from "../../../audit/application/audit.service";
import type { AuditLogEntry, CreateAuditLogInput, IAuditLogRepository } from "../../../audit/domain/audit-log.repository";
import type { CompanyRecord, ICompanyReader } from "../../domain/company-reader.repository";
import type { CustomerRecord, ICustomerRepository } from "../../../customers/domain/customer.repository";
import type {
  ApplyThirdPartyInvoiceResultInput,
  ElectronicInvoiceRecord,
  ElectronicInvoiceWithXml,
  GenerateElectronicInvoiceData,
  IElectronicInvoiceRepository,
} from "../../domain/electronic-invoice.repository";
import type { ICertificateLoader } from "../../domain/certificate-loader";
import type { IXmlSigner } from "../../domain/xml-signer";
import type { IThirdPartyInvoicingClient, ThirdPartyInvoiceInput, ThirdPartyInvoiceResult } from "../../domain/third-party-invoicing-client";
import { GenerateElectronicInvoiceUseCase } from "./generate-electronic-invoice.use-case";

const COMPANY: CompanyRecord = {
  id: "company-1",
  nit: "900123456-7",
  legalName: "Minimarket La Esquina S.A.S.",
  name: "Minimarket La Esquina",
  electronicInvoicingProvider: "DIRECT",
  matiasApiTokenEncrypted: null,
};

class FakeCompanyReader implements Partial<ICompanyReader> {
  async findByIdOrThrow(): Promise<CompanyRecord> {
    return COMPANY;
  }
}

class FakeCustomerRepository implements Partial<ICustomerRepository> {
  async findByIdOrThrow(): Promise<CustomerRecord> {
    throw new Error("no deberia consultarse sin customerId");
  }
}

class FakeInvoiceRepository implements IElectronicInvoiceRepository {
  lastClaimData: GenerateElectronicInvoiceData | null = null;
  async claimNumberAndGenerate(
    data: GenerateElectronicInvoiceData,
    build: (fullNumber: string, prefix: string, number: number) => { cufe: string; xmlContent: string }
  ): Promise<ElectronicInvoiceRecord> {
    this.lastClaimData = data;
    const { cufe } = build("SETP990000001", "SETP", 1);
    return {
      id: "inv-1",
      saleId: data.source.type === "sale" ? data.source.saleId : null,
      manualInvoiceId: data.source.type === "manual" ? data.source.manualInvoiceId : null,
      branchId: data.branchId,
      prefix: "SETP",
      number: 1,
      fullNumber: "SETP990000001",
      resolutionNumber: "18760000001",
      cufe,
      issueDate: data.issueDate,
      status: "GENERATED",
      createdAt: new Date(),
    };
  }
  async findBySaleId(): Promise<ElectronicInvoiceWithXml | null> {
    throw new Error("not implemented");
  }
  async findByManualInvoiceId(): Promise<ElectronicInvoiceWithXml | null> {
    throw new Error("not implemented");
  }
  async applyThirdPartySubmissionResult(): Promise<void> {
    throw new Error("not implemented");
  }
  async markSigned(): Promise<void> {}
  async markSubmitted(): Promise<void> {}
  async markAccepted(): Promise<void> {}
  async markRejected(): Promise<void> {}
  async findPendingSubmission() {
    return [];
  }
  async findAwaitingStatus() {
    return [];
  }
}

class FakeAuditLogRepository implements IAuditLogRepository {
  entries: CreateAuditLogInput[] = [];
  async create(input: CreateAuditLogInput): Promise<AuditLogEntry> {
    this.entries.push(input);
    return { id: `audit-${this.entries.length}`, metadata: input.metadata ?? null, createdAt: new Date(), ...input };
  }
  async list(): Promise<AuditLogEntry[]> {
    return [];
  }
}

const noopCertificateLoader = {} as ICertificateLoader;
const noopXmlSigner = {} as IXmlSigner;
const noopThirdPartyClient = {
  submitInvoice: vi.fn() as unknown as (apiToken: string, input: ThirdPartyInvoiceInput) => Promise<ThirdPartyInvoiceResult>,
} as unknown as IThirdPartyInvoicingClient;

function withTenantContext<T>(fn: () => Promise<T>): Promise<T> {
  return tenantStorage.run(
    { companyId: "company-1", branchId: null, userId: "user-1", roles: [], permissions: new Set() },
    fn
  );
}

const BASE_INPUT = {
  branchId: "branch-1",
  customerId: null,
  issueDate: new Date("2026-07-29T15:30:00.000Z"),
  subtotal: 100000,
  taxTotal: 19000,
  total: 119000,
  items: [{ description: "Arroz 500g", quantity: 2, unitPrice: 5000, taxPercent: 19, taxAmount: 1900, total: 10000 }],
  withholdingTaxes: [],
};

describe("GenerateElectronicInvoiceUseCase source discriminator", () => {
  it("passes a sale source through to claimNumberAndGenerate and audits with entityType Sale", async () => {
    const invoiceRepo = new FakeInvoiceRepository();
    const auditRepo = new FakeAuditLogRepository();
    const useCase = new GenerateElectronicInvoiceUseCase(
      invoiceRepo,
      new FakeCompanyReader() as unknown as ICompanyReader,
      new FakeCustomerRepository() as unknown as ICustomerRepository,
      new AuditService(auditRepo),
      noopCertificateLoader,
      noopXmlSigner,
      noopThirdPartyClient
    );

    const invoice = await withTenantContext(() =>
      useCase.execute({ ...BASE_INPUT, source: { type: "sale", saleId: "sale-1" } })
    );

    expect(invoiceRepo.lastClaimData?.source).toEqual({ type: "sale", saleId: "sale-1" });
    expect(invoice.saleId).toBe("sale-1");
    expect(invoice.manualInvoiceId).toBeNull();
    expect(auditRepo.entries).toContainEqual(
      expect.objectContaining({ action: "ELECTRONIC_INVOICE_GENERATED", entityType: "Sale", entityId: "sale-1" })
    );
  });

  it("passes a manual source through to claimNumberAndGenerate and audits with entityType ManualInvoice", async () => {
    const invoiceRepo = new FakeInvoiceRepository();
    const auditRepo = new FakeAuditLogRepository();
    const useCase = new GenerateElectronicInvoiceUseCase(
      invoiceRepo,
      new FakeCompanyReader() as unknown as ICompanyReader,
      new FakeCustomerRepository() as unknown as ICustomerRepository,
      new AuditService(auditRepo),
      noopCertificateLoader,
      noopXmlSigner,
      noopThirdPartyClient
    );

    const invoice = await withTenantContext(() =>
      useCase.execute({ ...BASE_INPUT, source: { type: "manual", manualInvoiceId: "manual-1" } })
    );

    expect(invoiceRepo.lastClaimData?.source).toEqual({ type: "manual", manualInvoiceId: "manual-1" });
    expect(invoice.saleId).toBeNull();
    expect(invoice.manualInvoiceId).toBe("manual-1");
    expect(auditRepo.entries).toContainEqual(
      expect.objectContaining({ action: "ELECTRONIC_INVOICE_GENERATED", entityType: "ManualInvoice", entityId: "manual-1" })
    );
  });
});
