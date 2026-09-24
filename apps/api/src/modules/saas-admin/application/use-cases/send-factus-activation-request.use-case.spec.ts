import { describe, expect, it } from "vitest";
import { AuditService } from "../../../audit/application/audit.service";
import type { AuditLogEntry, CreateAuditLogInput, IAuditLogRepository } from "../../../audit/domain/audit-log.repository";
import type {
  ApplyPaymentResult,
  CompanyWithSubscriptionRecord,
  ISubscriptionRepository,
  SaasDashboardStats,
  SubscriptionDueForAutoCharge,
  SubscriptionForLifecycleCheck,
  SubscriptionPaymentRecord,
  SubscriptionRecord,
  SubscriptionWithDetails,
} from "../../domain/subscription.repository";
import type { FactusActivationAttachment, FactusActivationRequestInput, IFactusActivationNotifier } from "../../domain/factus-activation-notifier";
import { SendFactusActivationRequestUseCase } from "./send-factus-activation-request.use-case";

const ATTACHMENT: FactusActivationAttachment = { filename: "doc.pdf", mediaType: "application/pdf", base64: "AAAA" };

class FakeSubscriptionRepository implements ISubscriptionRepository {
  companies: CompanyWithSubscriptionRecord[] = [];
  async create(): Promise<SubscriptionRecord> {
    throw new Error("not implemented");
  }
  async findByIdOrThrow(): Promise<SubscriptionRecord> {
    throw new Error("not implemented");
  }
  async findActiveByCompanyId(): Promise<SubscriptionRecord | null> {
    throw new Error("not implemented");
  }
  async findLatestByCompanyId(): Promise<SubscriptionRecord | null> {
    throw new Error("not implemented");
  }
  async updatePlan(): Promise<SubscriptionRecord> {
    throw new Error("not implemented");
  }
  async list(): Promise<SubscriptionWithDetails[]> {
    throw new Error("not implemented");
  }
  async updateStatus(): Promise<SubscriptionRecord> {
    throw new Error("not implemented");
  }
  async applyPayment(): Promise<ApplyPaymentResult> {
    throw new Error("not implemented");
  }
  async createPendingPayment(): Promise<SubscriptionPaymentRecord> {
    throw new Error("not implemented");
  }
  async findPaymentByReference(): Promise<SubscriptionPaymentRecord | null> {
    throw new Error("not implemented");
  }
  async confirmPayment(): Promise<ApplyPaymentResult> {
    throw new Error("not implemented");
  }
  async failPayment(): Promise<SubscriptionPaymentRecord> {
    throw new Error("not implemented");
  }
  async listForLifecycleCheck(): Promise<SubscriptionForLifecycleCheck[]> {
    throw new Error("not implemented");
  }
  async hasReminderLog(): Promise<boolean> {
    throw new Error("not implemented");
  }
  async createReminderLog(): Promise<void> {
    throw new Error("not implemented");
  }
  async listCompaniesWithSubscription(): Promise<CompanyWithSubscriptionRecord[]> {
    return this.companies;
  }
  async getDashboardStats(): Promise<SaasDashboardStats> {
    throw new Error("not implemented");
  }
  async savePaymentSource(): Promise<SubscriptionRecord> {
    throw new Error("not implemented");
  }
  async disableAutoRenew(): Promise<SubscriptionRecord> {
    throw new Error("not implemented");
  }
  async listDueForAutoCharge(): Promise<SubscriptionDueForAutoCharge[]> {
    throw new Error("not implemented");
  }
  async hasAutoChargeAttemptSince(): Promise<boolean> {
    throw new Error("not implemented");
  }
}

class FakeFactusActivationNotifier implements IFactusActivationNotifier {
  sent: FactusActivationRequestInput[] = [];
  shouldFail = false;
  async send(input: FactusActivationRequestInput): Promise<void> {
    if (this.shouldFail) throw new Error("RESEND_API_KEY no esta configurado");
    this.sent.push(input);
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

const COMPANY: CompanyWithSubscriptionRecord = {
  companyId: "company-1",
  companyName: "Minimarket La Esquina",
  nit: "900123456-7",
  isActive: true,
  subscriptionStatus: "ACTIVE",
  planName: "Plan Emprendedor",
  currentPeriodEnd: new Date("2027-01-01"),
  graceEndsAt: null,
};

describe("SendFactusActivationRequestUseCase", () => {
  it("envia los documentos y audita el envio", async () => {
    const subscriptionRepo = new FakeSubscriptionRepository();
    subscriptionRepo.companies = [COMPANY];
    const notifier = new FakeFactusActivationNotifier();
    const auditRepo = new FakeAuditLogRepository();
    const useCase = new SendFactusActivationRequestUseCase(subscriptionRepo, notifier, new AuditService(auditRepo));

    await useCase.execute({
      companyId: "company-1",
      platformAdminId: "admin-1",
      integrationVersion: "v2",
      rut: ATTACHMENT,
      legalRepCertificate: ATTACHMENT,
      legalRepId: ATTACHMENT,
      purchaseProof: ATTACHMENT,
      logo: ATTACHMENT,
    });

    expect(notifier.sent).toHaveLength(1);
    expect(notifier.sent[0]).toMatchObject({ companyName: "Minimarket La Esquina", nit: "900123456-7", integrationVersion: "v2" });
    expect(auditRepo.entries).toHaveLength(1);
    expect(auditRepo.entries[0]).toMatchObject({ action: "FACTUS_ACTIVATION_REQUEST_SENT", entityType: "Company", entityId: "company-1" });
  });

  it("permite legalRepCertificate null (persona natural)", async () => {
    const subscriptionRepo = new FakeSubscriptionRepository();
    subscriptionRepo.companies = [COMPANY];
    const notifier = new FakeFactusActivationNotifier();
    const useCase = new SendFactusActivationRequestUseCase(subscriptionRepo, notifier, new AuditService(new FakeAuditLogRepository()));

    await useCase.execute({
      companyId: "company-1",
      platformAdminId: "admin-1",
      integrationVersion: "v1",
      rut: ATTACHMENT,
      legalRepCertificate: null,
      legalRepId: ATTACHMENT,
      purchaseProof: ATTACHMENT,
      logo: ATTACHMENT,
    });

    expect(notifier.sent[0].legalRepCertificate).toBeNull();
  });

  it("lanza NotFoundError si la empresa no existe", async () => {
    const subscriptionRepo = new FakeSubscriptionRepository();
    subscriptionRepo.companies = [];
    const notifier = new FakeFactusActivationNotifier();
    const useCase = new SendFactusActivationRequestUseCase(subscriptionRepo, notifier, new AuditService(new FakeAuditLogRepository()));

    await expect(
      useCase.execute({
        companyId: "no-existe",
        platformAdminId: "admin-1",
        integrationVersion: "v2",
        rut: ATTACHMENT,
        legalRepCertificate: ATTACHMENT,
        legalRepId: ATTACHMENT,
        purchaseProof: ATTACHMENT,
        logo: ATTACHMENT,
      })
    ).rejects.toThrow();
    expect(notifier.sent).toHaveLength(0);
  });

  it("no audita si el envio del correo falla", async () => {
    const subscriptionRepo = new FakeSubscriptionRepository();
    subscriptionRepo.companies = [COMPANY];
    const notifier = new FakeFactusActivationNotifier();
    notifier.shouldFail = true;
    const auditRepo = new FakeAuditLogRepository();
    const useCase = new SendFactusActivationRequestUseCase(subscriptionRepo, notifier, new AuditService(auditRepo));

    await expect(
      useCase.execute({
        companyId: "company-1",
        platformAdminId: "admin-1",
        integrationVersion: "v2",
        rut: ATTACHMENT,
        legalRepCertificate: ATTACHMENT,
        legalRepId: ATTACHMENT,
        purchaseProof: ATTACHMENT,
        logo: ATTACHMENT,
      })
    ).rejects.toThrow("RESEND_API_KEY");
    expect(auditRepo.entries).toHaveLength(0);
  });
});
