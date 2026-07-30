import { describe, expect, it } from "vitest";
import { tenantStorage } from "../../../../shared/context/request-context";
import { AuditService } from "../../../audit/application/audit.service";
import type { AuditLogEntry, IAuditLogRepository } from "../../../audit/domain/audit-log.repository";
import type { DianStatusResult, DianSubmissionResult, IDianClient } from "../../domain/dian-client";
import type {
  ElectronicDocumentAwaitingStatus,
  ElectronicDocumentPendingSubmission,
  IElectronicDocumentSubmissionRepository,
} from "../../domain/electronic-document-submission.repository";
import { PollDianSubmissionsUseCase } from "./poll-dian-submissions.use-case";

function makePending(overrides: Partial<ElectronicDocumentPendingSubmission> = {}): ElectronicDocumentPendingSubmission {
  return {
    id: "inv-1",
    sourceEntityId: "sale-1",
    fullNumber: "SETP1",
    status: "PENDING_SUBMISSION",
    signedXmlContent: "<Invoice><Signature/></Invoice>",
    ...overrides,
  };
}

class FakeSubmissionRepository implements IElectronicDocumentSubmissionRepository {
  pendingSubmission: ElectronicDocumentPendingSubmission[] = [];
  awaitingStatus: ElectronicDocumentAwaitingStatus[] = [];
  marked: Array<{ method: string; id: string; args: unknown[] }> = [];

  async markSigned(id: string, signedXmlContent: string): Promise<void> {
    this.marked.push({ method: "markSigned", id, args: [signedXmlContent] });
  }
  async markSubmitted(id: string, trackingId: string): Promise<void> {
    this.marked.push({ method: "markSubmitted", id, args: [trackingId] });
  }
  async markAccepted(id: string, responseXml: string): Promise<void> {
    this.marked.push({ method: "markAccepted", id, args: [responseXml] });
  }
  async markRejected(id: string, responseXml: string, reason: string): Promise<void> {
    this.marked.push({ method: "markRejected", id, args: [responseXml, reason] });
  }
  async findPendingSubmission(): Promise<ElectronicDocumentPendingSubmission[]> {
    return this.pendingSubmission;
  }
  async findAwaitingStatus(): Promise<ElectronicDocumentAwaitingStatus[]> {
    return this.awaitingStatus;
  }
}

class FakeDianClient implements IDianClient {
  sendBillAsyncResult: DianSubmissionResult | (() => never) = { trackingId: "track-1" };
  getStatusResult: DianStatusResult | (() => never) = { status: "PENDING" };
  sendBillAsyncCalls: string[] = [];
  getStatusCalls: string[] = [];

  async sendBillAsync(signedXml: string): Promise<DianSubmissionResult> {
    this.sendBillAsyncCalls.push(signedXml);
    if (typeof this.sendBillAsyncResult === "function") this.sendBillAsyncResult();
    return this.sendBillAsyncResult as DianSubmissionResult;
  }
  async getStatus(trackingId: string): Promise<DianStatusResult> {
    this.getStatusCalls.push(trackingId);
    if (typeof this.getStatusResult === "function") this.getStatusResult();
    return this.getStatusResult as DianStatusResult;
  }
}

class NoopAuditLogRepository implements IAuditLogRepository {
  async create(input: Parameters<IAuditLogRepository["create"]>[0]): Promise<AuditLogEntry> {
    return {
      id: "log-1",
      companyId: input.companyId,
      branchId: input.branchId,
      userId: input.userId,
      action: input.action,
      entityType: input.entityType,
      entityId: input.entityId,
      description: input.description,
      metadata: input.metadata ?? null,
      createdAt: new Date(),
    };
  }
  async list(): Promise<AuditLogEntry[]> {
    return [];
  }
}

function runWithTenantContext<T>(fn: () => Promise<T>): Promise<T> {
  return tenantStorage.run(
    { companyId: "company-1", branchId: "branch-1", userId: "user-1", roles: [], permissions: new Set() },
    fn
  );
}

function makeUseCase(repo: FakeSubmissionRepository, dianClient: FakeDianClient): PollDianSubmissionsUseCase {
  return new PollDianSubmissionsUseCase(
    repo,
    dianClient,
    new AuditService(new NoopAuditLogRepository()),
    "Sale",
    "Factura electronica"
  );
}

describe("PollDianSubmissionsUseCase", () => {
  it("submits pending documents without a tracking id and marks them submitted", async () => {
    const repo = new FakeSubmissionRepository();
    repo.pendingSubmission = [makePending()];
    const dianClient = new FakeDianClient();
    const useCase = makeUseCase(repo, dianClient);

    await runWithTenantContext(() => useCase.execute());

    expect(dianClient.sendBillAsyncCalls).toHaveLength(1);
    expect(repo.marked).toContainEqual({ method: "markSubmitted", id: "inv-1", args: ["track-1"] });
  });

  it("marks a document ACCEPTED when the DIAN reports it accepted", async () => {
    const repo = new FakeSubmissionRepository();
    repo.awaitingStatus = [
      { id: "inv-2", sourceEntityId: "sale-2", fullNumber: "SETP2", status: "PENDING_SUBMISSION", dianTrackingId: "track-2" },
    ];
    const dianClient = new FakeDianClient();
    dianClient.getStatusResult = { status: "ACCEPTED", responseXml: "<ok/>" };
    const useCase = makeUseCase(repo, dianClient);

    await runWithTenantContext(() => useCase.execute());

    expect(repo.marked).toContainEqual({ method: "markAccepted", id: "inv-2", args: ["<ok/>"] });
  });

  it("marks a document REJECTED with the reason when the DIAN reports it rejected", async () => {
    const repo = new FakeSubmissionRepository();
    repo.awaitingStatus = [
      { id: "inv-3", sourceEntityId: "sale-3", fullNumber: "SETP3", status: "PENDING_SUBMISSION", dianTrackingId: "track-3" },
    ];
    const dianClient = new FakeDianClient();
    dianClient.getStatusResult = { status: "REJECTED", responseXml: "<err/>", rejectionReason: "CUFE invalido" };
    const useCase = makeUseCase(repo, dianClient);

    await runWithTenantContext(() => useCase.execute());

    expect(repo.marked).toContainEqual({ method: "markRejected", id: "inv-3", args: ["<err/>", "CUFE invalido"] });
  });

  it("leaves a PENDING status untouched (no-op, retried next tick)", async () => {
    const repo = new FakeSubmissionRepository();
    repo.awaitingStatus = [
      { id: "inv-4", sourceEntityId: "sale-4", fullNumber: "SETP4", status: "PENDING_SUBMISSION", dianTrackingId: "track-4" },
    ];
    const dianClient = new FakeDianClient();
    dianClient.getStatusResult = { status: "PENDING" };
    const useCase = makeUseCase(repo, dianClient);

    await runWithTenantContext(() => useCase.execute());

    expect(repo.marked).toHaveLength(0);
  });

  it("does not crash and marks nothing when the DIAN client throws", async () => {
    const repo = new FakeSubmissionRepository();
    repo.pendingSubmission = [makePending()];
    const dianClient = new FakeDianClient();
    dianClient.sendBillAsyncResult = () => {
      throw new Error("network down");
    };
    const useCase = makeUseCase(repo, dianClient);

    await expect(runWithTenantContext(() => useCase.execute())).resolves.toBeUndefined();
    expect(repo.marked).toHaveLength(0);
  });
});
