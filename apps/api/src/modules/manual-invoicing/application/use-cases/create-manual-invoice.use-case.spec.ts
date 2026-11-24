import type { ManualInvoiceJournalEntryInput, PostManualInvoiceJournalEntryUseCase } from "../../../accounting/application/use-cases/post-manual-invoice-journal-entry.use-case";
import type { CreateAccountReceivableData, IAccountReceivableRepository } from "../../../collections/domain/account-receivable.repository";
import { describe, expect, it, vi } from "vitest";
import { tenantStorage } from "../../../../shared/context/request-context";
import { ValidationError } from "../../../../shared/errors/app-error";
import { AuditService } from "../../../audit/application/audit.service";
import type { AuditLogEntry, CreateAuditLogInput, IAuditLogRepository } from "../../../audit/domain/audit-log.repository";
import type { CompanyProfileRecord, ICompanyProfileRepository } from "../../../company/domain/company-profile.repository";
import type { GenerateElectronicInvoiceUseCase } from "../../../electronic-invoicing/application/use-cases/generate-electronic-invoice.use-case";
import type { CreateManualInvoiceData, IManualInvoiceRepository, ManualInvoiceRecord } from "../../domain/manual-invoice.repository";
import { CreateManualInvoiceUseCase } from "./create-manual-invoice.use-case";

const COMPLETE_PROFILE: CompanyProfileRecord = {
  id: "company-1",
  name: "Minimarket La Esquina",
  legalName: "Minimarket La Esquina S.A.S.",
  nit: "900123456-7",
  email: "contacto@minimarket.co",
  phone: null,
  documentType: "NIT",
  dv: "7",
  taxRegime: "Responsable de IVA",
  fiscalResponsibilities: "O-13",
  address: "Calle 10 # 20-30",
  municipality: "Manizales",
  department: "Caldas",
  municipalityCode: null,
  economicActivity: null, whatsapp: null, website: null, instagram: null, receiptHeader: null, receiptFooter: null, logoUrl: null,
};

class FakeCompanyProfileRepository implements Partial<ICompanyProfileRepository> {
  constructor(private readonly profile: CompanyProfileRecord) {}
  async findByIdOrThrow(): Promise<CompanyProfileRecord> {
    return this.profile;
  }
}

class FakeManualInvoiceRepository implements IManualInvoiceRepository {
  created: CreateManualInvoiceData[] = [];
  async create(data: CreateManualInvoiceData): Promise<ManualInvoiceRecord> {
    this.created.push(data);
    return {
      id: "manual-invoice-1",
      branchId: data.branchId,
      customerId: data.customerId,
      createdByUserId: data.createdByUserId,
      issueDate: data.issueDate,
      subtotal: data.subtotal,
      taxTotal: data.taxTotal,
      total: data.total,
      cufe: null,
      invoiceXmlUrl: null,
      createdAt: new Date(),
      dueDate: data.dueDate ?? null,
      journalEntryId: null,
      items: data.items.map((item, i) => ({ id: `item-${i}`, ...item })),
    };
  }
  journalEntryIds: string[] = [];
  async setJournalEntryId(_id: string, journalEntryId: string): Promise<void> {
    this.journalEntryIds.push(journalEntryId);
  }
  async findByIdOrThrow(): Promise<ManualInvoiceRecord> {
    throw new Error("not implemented");
  }
  async list(): Promise<ManualInvoiceRecord[]> {
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

function withTenantContext<T>(fn: () => Promise<T>): Promise<T> {
  return tenantStorage.run(
    { companyId: "company-1", branchId: null, userId: "user-1", roles: [], permissions: new Set() },
    fn
  );
}

/** Contabilidad y cartera falsas: guardan lo que recibieron. */
function accountingFakes() {
  const journal: ManualInvoiceJournalEntryInput[] = [];
  const receivables: CreateAccountReceivableData[] = [];
  const postJournal = {
    execute: vi.fn(async (input: ManualInvoiceJournalEntryInput) => {
      journal.push(input);
      return { id: "je-1", number: 7 };
    }),
  } as unknown as PostManualInvoiceJournalEntryUseCase;
  const arRepo = {
    create: vi.fn(async (data: CreateAccountReceivableData) => {
      receivables.push(data);
      return {};
    }),
  } as unknown as IAccountReceivableRepository;
  return { journal, receivables, deps: [postJournal, arRepo] as const };
}

describe("CreateManualInvoiceUseCase", () => {
  it("rejects when the company profile is incomplete, listing the missing fields", async () => {
    const manualInvoiceRepo = new FakeManualInvoiceRepository();
    const companyProfileRepo = new FakeCompanyProfileRepository({ ...COMPLETE_PROFILE, dv: null, address: null });
    const generateElectronicInvoice = { execute: vi.fn() } as unknown as GenerateElectronicInvoiceUseCase;
    const useCase = new CreateManualInvoiceUseCase(
      manualInvoiceRepo,
      companyProfileRepo as unknown as ICompanyProfileRepository,
      generateElectronicInvoice,
      new AuditService(new FakeAuditLogRepository()),
      ...accountingFakes().deps
    );

    await expect(
      withTenantContext(() =>
        useCase.execute({ branchId: "branch-1", items: [{ description: "Consultoria", quantity: 1, unitPrice: 100000, taxPercent: 19 }] })
      )
    ).rejects.toThrow(ValidationError);
    expect(manualInvoiceRepo.created).toHaveLength(0);
    expect(generateElectronicInvoice.execute).not.toHaveBeenCalled();
  });

  it("computes totals per line, persists the invoice, and calls the electronic-invoice generator with a manual source", async () => {
    const manualInvoiceRepo = new FakeManualInvoiceRepository();
    const companyProfileRepo = new FakeCompanyProfileRepository(COMPLETE_PROFILE);
    const generateElectronicInvoice = { execute: vi.fn().mockResolvedValue({}) } as unknown as GenerateElectronicInvoiceUseCase;
    const auditRepo = new FakeAuditLogRepository();
    const useCase = new CreateManualInvoiceUseCase(
      manualInvoiceRepo,
      companyProfileRepo as unknown as ICompanyProfileRepository,
      generateElectronicInvoice,
      new AuditService(auditRepo),
      ...accountingFakes().deps
    );

    const invoice = await withTenantContext(() =>
      useCase.execute({
        branchId: "branch-1",
        customerId: "customer-1",
        items: [
          { description: "Consultoria", quantity: 2, unitPrice: 100000, taxPercent: 19 },
          { description: "Soporte", quantity: 1, unitPrice: 50000, taxPercent: 0 },
        ],
      })
    );

    expect(invoice.subtotal).toBe(250000);
    expect(invoice.taxTotal).toBe(38000); // 19% de 200000, la segunda linea no tiene IVA
    expect(invoice.total).toBe(288000);
    expect(manualInvoiceRepo.created).toHaveLength(1);
    expect(generateElectronicInvoice.execute).toHaveBeenCalledWith(
      expect.objectContaining({
        source: { type: "manual", manualInvoiceId: "manual-invoice-1" },
        customerId: "customer-1",
        subtotal: 250000,
        taxTotal: 38000,
        total: 288000,
        withholdingTaxes: [],
      })
    );
    expect(auditRepo.entries.some((e) => e.action === "MANUAL_INVOICE_CREATED")).toBe(true);
  });

  it("does not block the invoice when electronic-invoice generation fails, and audits the failure", async () => {
    const manualInvoiceRepo = new FakeManualInvoiceRepository();
    const companyProfileRepo = new FakeCompanyProfileRepository(COMPLETE_PROFILE);
    const generateElectronicInvoice = {
      execute: vi.fn().mockRejectedValue(new Error("Factus no responde")),
    } as unknown as GenerateElectronicInvoiceUseCase;
    const auditRepo = new FakeAuditLogRepository();
    const useCase = new CreateManualInvoiceUseCase(
      manualInvoiceRepo,
      companyProfileRepo as unknown as ICompanyProfileRepository,
      generateElectronicInvoice,
      new AuditService(auditRepo),
      ...accountingFakes().deps
    );

    const invoice = await withTenantContext(() =>
      useCase.execute({ branchId: "branch-1", items: [{ description: "Consultoria", quantity: 1, unitPrice: 100000, taxPercent: 19 }] })
    );

    expect(invoice.id).toBe("manual-invoice-1");
    expect(auditRepo.entries.some((e) => e.action === "ELECTRONIC_INVOICE_GENERATION_FAILED")).toBe(true);
  });

  it("posts income, IVA and INC and opens a receivable when the invoice has a customer", async () => {
    const manualInvoiceRepo = new FakeManualInvoiceRepository();
    const fakes = accountingFakes();
    const useCase = new CreateManualInvoiceUseCase(
      manualInvoiceRepo,
      new FakeCompanyProfileRepository(COMPLETE_PROFILE) as unknown as ICompanyProfileRepository,
      { execute: vi.fn().mockResolvedValue({}) } as unknown as GenerateElectronicInvoiceUseCase,
      new AuditService(new FakeAuditLogRepository()),
      ...fakes.deps
    );

    await withTenantContext(() =>
      useCase.execute({
        branchId: "branch-1",
        customerId: "customer-1",
        dueDate: new Date("2026-12-31T00:00:00Z"),
        items: [
          { description: "Consultoria", quantity: 1, unitPrice: 100000, taxPercent: 19 },
          { description: "Almuerzo", quantity: 1, unitPrice: 50000, taxPercent: 8, taxType: "INC" },
        ],
      })
    );

    expect(fakes.journal[0]).toEqual(expect.objectContaining({ subtotal: 150000, ivaTotal: 19000, incTotal: 4000, onCredit: true }));
    expect(manualInvoiceRepo.journalEntryIds).toEqual(["je-1"]);
    expect(fakes.receivables).toEqual([{ customerId: "customer-1", manualInvoiceId: "manual-invoice-1", amount: 173000, dueDate: new Date("2026-12-31T00:00:00Z") }]);
  });

  it("does not post accounting for invoices of an external POS (postAccounting false), already posted by its shift close", async () => {
    const fakes = accountingFakes();
    const useCase = new CreateManualInvoiceUseCase(
      new FakeManualInvoiceRepository(),
      new FakeCompanyProfileRepository(COMPLETE_PROFILE) as unknown as ICompanyProfileRepository,
      { execute: vi.fn().mockResolvedValue({}) } as unknown as GenerateElectronicInvoiceUseCase,
      new AuditService(new FakeAuditLogRepository()),
      ...fakes.deps
    );
    await withTenantContext(() =>
      useCase.execute({ branchId: "branch-1", customerId: "customer-1", postAccounting: false, items: [{ description: "x", quantity: 1, unitPrice: 1000, taxPercent: 19 }] })
    );
    expect(fakes.journal).toHaveLength(0);
    expect(fakes.receivables).toHaveLength(0);
  });
});
