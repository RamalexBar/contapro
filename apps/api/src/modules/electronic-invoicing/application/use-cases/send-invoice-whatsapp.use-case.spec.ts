import { describe, expect, it, vi } from "vitest";
import { tenantStorage } from "../../../../shared/context/request-context";
import { AuditService } from "../../../audit/application/audit.service";
import type { AuditLogEntry, CreateAuditLogInput, IAuditLogRepository } from "../../../audit/domain/audit-log.repository";
import type { CustomerRecord, ICustomerRepository } from "../../../customers/domain/customer.repository";
import type { IWhatsAppSender, WhatsAppDocumentPayload } from "../../../whatsapp/domain/whatsapp-sender.port";
import type { IWhatsAppDeliveryLogRepository, RecordWhatsAppDeliveryData, WhatsAppDeliveryLogRecord } from "../../../whatsapp/domain/whatsapp-delivery-log.repository";
import { buildUblInvoiceXml } from "../ubl-invoice-xml-builder";
import type { GetElectronicInvoiceUseCase } from "./get-electronic-invoice.use-case";
import { SendInvoiceWhatsAppUseCase } from "./send-invoice-whatsapp.use-case";

const issueDate = new Date("2026-07-29T15:30:00.000Z");
const xmlContent = buildUblInvoiceXml({
  fullNumber: "SETP990000001",
  cufe: "a".repeat(96),
  issueDate,
  environment: "HABILITACION",
  issuer: { nit: "900123456-7", legalName: "Minimarket La Esquina S.A.S." },
  buyer: { documentType: "CC", documentNumber: "1023456789", name: "Laura Gomez" },
  subtotal: 100000,
  taxTotal: 19000,
  total: 119000,
  items: [{ description: "Arroz 500g", quantity: 2, unitPrice: 5000, taxPercent: 19, taxAmount: 1900, total: 10000 }],
  withholdingTaxes: [],
});

const CUSTOMER_WITH_PHONE: CustomerRecord = {
  id: "customer-1",
  documentType: "CC",
  documentNumber: "1023456789",
  name: "Laura Gomez",
  email: null,
  phone: "3001234567",
  creditLimit: 0,
  currentBalance: 0,
  isActive: true,
  priceListId: null,
  municipalityCode: null,
  address: null,
  dianIdentityDocumentId: null,
  dianTypeOrganizationId: null,
  dianTaxRegimeId: null,
  dianTaxLevelId: null,
  dianCountryId: null,
  dianCityId: null,
  dianPostalCode: null,
};
const CUSTOMER_NO_PHONE: CustomerRecord = { ...CUSTOMER_WITH_PHONE, id: "customer-2", phone: null };

class FakeCustomerRepository implements Partial<ICustomerRepository> {
  constructor(private readonly customers: CustomerRecord[]) {}
  async findByIdOrThrow(id: string): Promise<CustomerRecord> {
    const found = this.customers.find((c) => c.id === id);
    if (!found) throw new Error("not found");
    return found;
  }
}

class FakeWhatsAppSender implements IWhatsAppSender {
  sentDocuments: Array<{ to: string; doc: WhatsAppDocumentPayload }> = [];
  shouldFail = false;
  async sendText(): Promise<void> {
    throw new Error("not implemented");
  }
  async sendDocument(to: string, doc: WhatsAppDocumentPayload): Promise<void> {
    if (this.shouldFail) throw new Error("WHATSAPP_ACCESS_TOKEN no esta configurado");
    this.sentDocuments.push({ to, doc });
  }
}

class FakeDeliveryLogRepository implements Partial<IWhatsAppDeliveryLogRepository> {
  recorded: RecordWhatsAppDeliveryData[] = [];
  async record(data: RecordWhatsAppDeliveryData): Promise<WhatsAppDeliveryLogRecord> {
    this.recorded.push(data);
    return { id: `log-${this.recorded.length}`, sentAt: new Date(), errorMessage: data.errorMessage ?? null, ...data };
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

function withTenantContext<T>(fn: () => Promise<T>): Promise<T> {
  return tenantStorage.run(
    { companyId: "company-1", branchId: null, userId: "user-1", roles: [], permissions: new Set() },
    fn
  );
}

function makeGetInvoiceUseCase(): GetElectronicInvoiceUseCase {
  return {
    execute: vi.fn().mockResolvedValue({
      id: "inv-1",
      saleId: "sale-1",
      branchId: "branch-1",
      prefix: "SETP",
      number: 1,
      fullNumber: "SETP990000001",
      cufe: "a".repeat(96),
      issueDate,
      status: "PENDING_SUBMISSION",
      createdAt: issueDate,
      xmlContent,
      signedXmlContent: null,
      dianTrackingId: null,
      rejectionReason: null,
    }),
  } as unknown as GetElectronicInvoiceUseCase;
}

describe("SendInvoiceWhatsAppUseCase", () => {
  it("does nothing when the sale has no customer", async () => {
    const sender = new FakeWhatsAppSender();
    const deliveryRepo = new FakeDeliveryLogRepository();
    const useCase = new SendInvoiceWhatsAppUseCase(
      new FakeCustomerRepository([]) as unknown as ICustomerRepository,
      makeGetInvoiceUseCase(),
      sender,
      deliveryRepo as unknown as IWhatsAppDeliveryLogRepository,
      new AuditService(new FakeAuditLogRepository())
    );

    await withTenantContext(() => useCase.execute({ saleId: "sale-1", customerId: null }));

    expect(sender.sentDocuments).toHaveLength(0);
    expect(deliveryRepo.recorded).toHaveLength(0);
  });

  it("does nothing when the customer has no phone", async () => {
    const sender = new FakeWhatsAppSender();
    const deliveryRepo = new FakeDeliveryLogRepository();
    const useCase = new SendInvoiceWhatsAppUseCase(
      new FakeCustomerRepository([CUSTOMER_NO_PHONE]) as unknown as ICustomerRepository,
      makeGetInvoiceUseCase(),
      sender,
      deliveryRepo as unknown as IWhatsAppDeliveryLogRepository,
      new AuditService(new FakeAuditLogRepository())
    );

    await withTenantContext(() => useCase.execute({ saleId: "sale-1", customerId: "customer-2" }));

    expect(sender.sentDocuments).toHaveLength(0);
    expect(deliveryRepo.recorded).toHaveLength(0);
  });

  it("renders the RIDE and sends it, recording success", async () => {
    const sender = new FakeWhatsAppSender();
    const deliveryRepo = new FakeDeliveryLogRepository();
    const auditRepo = new FakeAuditLogRepository();
    const useCase = new SendInvoiceWhatsAppUseCase(
      new FakeCustomerRepository([CUSTOMER_WITH_PHONE]) as unknown as ICustomerRepository,
      makeGetInvoiceUseCase(),
      sender,
      deliveryRepo as unknown as IWhatsAppDeliveryLogRepository,
      new AuditService(auditRepo)
    );

    await withTenantContext(() => useCase.execute({ saleId: "sale-1", customerId: "customer-1" }));

    expect(sender.sentDocuments).toHaveLength(1);
    expect(sender.sentDocuments[0].to).toBe("573001234567");
    expect(sender.sentDocuments[0].doc.buffer.byteLength).toBeGreaterThan(0);
    expect(deliveryRepo.recorded).toEqual([
      expect.objectContaining({ messageType: "SALE_INVOICE_RIDE", referenceId: "sale-1", success: true }),
    ]);
    expect(auditRepo.entries.some((e) => e.action === "WHATSAPP_RIDE_SENT")).toBe(true);
  });

  it("records a failure without throwing when the sender fails", async () => {
    const sender = new FakeWhatsAppSender();
    sender.shouldFail = true;
    const deliveryRepo = new FakeDeliveryLogRepository();
    const auditRepo = new FakeAuditLogRepository();
    const useCase = new SendInvoiceWhatsAppUseCase(
      new FakeCustomerRepository([CUSTOMER_WITH_PHONE]) as unknown as ICustomerRepository,
      makeGetInvoiceUseCase(),
      sender,
      deliveryRepo as unknown as IWhatsAppDeliveryLogRepository,
      new AuditService(auditRepo)
    );

    await withTenantContext(() => useCase.execute({ saleId: "sale-1", customerId: "customer-1" }));

    expect(deliveryRepo.recorded).toEqual([
      expect.objectContaining({ messageType: "SALE_INVOICE_RIDE", success: false }),
    ]);
    expect(auditRepo.entries.some((e) => e.action === "WHATSAPP_RIDE_SEND_FAILED")).toBe(true);
  });
});
