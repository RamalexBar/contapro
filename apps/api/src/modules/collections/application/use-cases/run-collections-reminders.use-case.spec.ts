import { describe, expect, it } from "vitest";
import { tenantStorage } from "../../../../shared/context/request-context";
import { AuditService } from "../../../audit/application/audit.service";
import type { AuditLogEntry, CreateAuditLogInput, IAuditLogRepository } from "../../../audit/domain/audit-log.repository";
import type { AccountReceivableRecord, IAccountReceivableRepository } from "../../domain/account-receivable.repository";
import type { CollectionReminderNotification, ICollectionReminderNotifier } from "../../domain/collection-reminder-notifier";
import type { CustomerRecord, ICustomerRepository } from "../../../customers/domain/customer.repository";
import type { ISaleRepository, SaleRecord } from "../../../pos/sale/domain/sale.repository";
import type { IWhatsAppSender } from "../../../whatsapp/domain/whatsapp-sender.port";
import { RunCollectionsRemindersUseCase } from "./run-collections-reminders.use-case";

const RECEIVABLE: AccountReceivableRecord = {
  id: "receivable-1",
  customerId: "customer-1",
  saleId: "sale-1",
  branchId: "branch-1",
  amount: 100000,
  balance: 100000,
  dueDate: new Date(),
  status: "PENDING",
};

const CUSTOMER_WITH_PHONE: CustomerRecord = {
  id: "customer-1",
  documentType: "CC",
  documentNumber: "1023456789",
  name: "Laura Gomez",
  email: "laura@example.com",
  phone: "3001234567",
  creditLimit: 0,
  currentBalance: 0,
  isActive: true,
  priceListId: null,
  municipalityCode: null,
};
const CUSTOMER_NO_PHONE: CustomerRecord = { ...CUSTOMER_WITH_PHONE, phone: null };
const CUSTOMER_NO_PHONE_NO_EMAIL: CustomerRecord = { ...CUSTOMER_WITH_PHONE, phone: null, email: null };

const SALE: SaleRecord = {
  id: "sale-1",
  companyId: "company-1",
  branchId: "branch-1",
  number: 42,
  customerId: "customer-1",
  status: "COMPLETED",
} as unknown as SaleRecord;

class FakeAccountReceivableRepository implements Partial<IAccountReceivableRepository> {
  reminderLogs = new Map<string, string>();
  async listActive(): Promise<AccountReceivableRecord[]> {
    return [RECEIVABLE];
  }
  async hasReminderLog(): Promise<boolean> {
    return false;
  }
  async createReminderLog(accountReceivableId: string, daysBeforeDue: number, channel: string): Promise<void> {
    this.reminderLogs.set(`${accountReceivableId}:${daysBeforeDue}`, channel);
  }
}

class FakeCustomerRepository implements Partial<ICustomerRepository> {
  constructor(private readonly customer: CustomerRecord) {}
  async findByIdOrThrow(): Promise<CustomerRecord> {
    return this.customer;
  }
}

class FakeSaleRepository implements Partial<ISaleRepository> {
  async findByIdOrThrow(): Promise<SaleRecord> {
    return SALE;
  }
}

class FakeNotifier implements ICollectionReminderNotifier {
  sent: CollectionReminderNotification[] = [];
  async send(notification: CollectionReminderNotification): Promise<void> {
    this.sent.push(notification);
  }
}

class FakeWhatsAppSender implements IWhatsAppSender {
  sent: Array<{ to: string; message: string }> = [];
  shouldFail = false;
  async sendText(to: string, message: string): Promise<void> {
    if (this.shouldFail) throw new Error("WHATSAPP_ACCESS_TOKEN no esta configurado");
    this.sent.push({ to, message });
  }
  async sendDocument(): Promise<void> {
    throw new Error("not implemented");
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

function makeUseCase(customer: CustomerRecord, whatsApp: FakeWhatsAppSender, notifier: FakeNotifier, receivableRepo: FakeAccountReceivableRepository) {
  return new RunCollectionsRemindersUseCase(
    receivableRepo as unknown as IAccountReceivableRepository,
    new FakeCustomerRepository(customer) as unknown as ICustomerRepository,
    new FakeSaleRepository() as unknown as ISaleRepository,
    notifier,
    whatsApp,
    new AuditService(new FakeAuditLogRepository())
  );
}

function withTenantContext<T>(fn: () => Promise<T>): Promise<T> {
  return tenantStorage.run(
    { companyId: "company-1", branchId: null, userId: "user-1", roles: [], permissions: new Set() },
    fn
  );
}

describe("RunCollectionsRemindersUseCase", () => {
  it("prefers WhatsApp over email when the customer has a phone and WhatsApp succeeds", async () => {
    const whatsApp = new FakeWhatsAppSender();
    const notifier = new FakeNotifier();
    const receivableRepo = new FakeAccountReceivableRepository();
    const useCase = makeUseCase(CUSTOMER_WITH_PHONE, whatsApp, notifier, receivableRepo);

    await withTenantContext(() => useCase.execute());

    expect(whatsApp.sent).toHaveLength(1);
    expect(whatsApp.sent[0].to).toBe("573001234567");
    expect(notifier.sent).toHaveLength(0);
    expect(receivableRepo.reminderLogs.get("receivable-1:0")).toBe("WHATSAPP");
  });

  it("falls back to email when WhatsApp fails", async () => {
    const whatsApp = new FakeWhatsAppSender();
    whatsApp.shouldFail = true;
    const notifier = new FakeNotifier();
    const receivableRepo = new FakeAccountReceivableRepository();
    const useCase = makeUseCase(CUSTOMER_WITH_PHONE, whatsApp, notifier, receivableRepo);

    await withTenantContext(() => useCase.execute());

    expect(whatsApp.sent).toHaveLength(0);
    expect(notifier.sent).toHaveLength(1);
    expect(receivableRepo.reminderLogs.get("receivable-1:0")).toBe("EMAIL");
  });

  it("goes straight to email when the customer has no phone", async () => {
    const whatsApp = new FakeWhatsAppSender();
    const notifier = new FakeNotifier();
    const receivableRepo = new FakeAccountReceivableRepository();
    const useCase = makeUseCase(CUSTOMER_NO_PHONE, whatsApp, notifier, receivableRepo);

    await withTenantContext(() => useCase.execute());

    expect(whatsApp.sent).toHaveLength(0);
    expect(notifier.sent).toHaveLength(1);
    expect(receivableRepo.reminderLogs.get("receivable-1:0")).toBe("EMAIL");
  });

  it("throws (leaving the reminder unlogged) when neither WhatsApp nor email is available", async () => {
    const whatsApp = new FakeWhatsAppSender();
    const notifier = new FakeNotifier();
    const receivableRepo = new FakeAccountReceivableRepository();
    const auditRepo = new FakeAuditLogRepository();
    const useCase = new RunCollectionsRemindersUseCase(
      receivableRepo as unknown as IAccountReceivableRepository,
      new FakeCustomerRepository(CUSTOMER_NO_PHONE_NO_EMAIL) as unknown as ICustomerRepository,
      new FakeSaleRepository() as unknown as ISaleRepository,
      notifier,
      whatsApp,
      new AuditService(auditRepo)
    );

    await withTenantContext(() => useCase.execute());

    expect(receivableRepo.reminderLogs.size).toBe(0);
    expect(auditRepo.entries.some((e) => e.action === "COLLECTION_REMINDER_FAILED")).toBe(true);
  });
});
