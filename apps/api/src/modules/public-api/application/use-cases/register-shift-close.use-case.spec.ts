import { describe, expect, it, vi } from "vitest";
import { tenantStorage } from "../../../../shared/context/request-context";
import { AuditService } from "../../../audit/application/audit.service";
import type { AuditLogEntry, CreateAuditLogInput, IAuditLogRepository } from "../../../audit/domain/audit-log.repository";
import type {
  CreateExternalShiftCloseData,
  ExternalShiftCloseRecord,
  IExternalShiftCloseRepository,
  UpdateExternalShiftCloseData,
} from "../../domain/external-shift-close.repository";
import type { PostShiftCloseJournalEntryUseCase } from "../../../accounting/application/use-cases/post-shift-close-journal-entry.use-case";
import { RegisterShiftCloseUseCase } from "./register-shift-close.use-case";
import type { RegisterShiftCloseInput } from "@erp/shared-types";

class FakeExternalShiftCloseRepository implements IExternalShiftCloseRepository {
  records: ExternalShiftCloseRecord[] = [];
  async create(data: CreateExternalShiftCloseData): Promise<ExternalShiftCloseRecord> {
    const record: ExternalShiftCloseRecord = {
      id: data.id,
      companyId: "company-1",
      branchId: data.branchId,
      externalReference: data.externalReference,
      status: data.status,
      journalEntryIds: data.journalEntryIds,
      errorMessage: data.errorMessage ?? null,
      createdAt: new Date(),
    };
    this.records.push(record);
    return record;
  }
  async update(id: string, data: UpdateExternalShiftCloseData): Promise<ExternalShiftCloseRecord> {
    const record = this.records.find((r) => r.id === id);
    if (!record) throw new Error("not found");
    record.status = data.status;
    record.journalEntryIds = data.journalEntryIds;
    record.errorMessage = data.errorMessage ?? null;
    return record;
  }
  async findByExternalReference(externalReference: string): Promise<ExternalShiftCloseRecord | null> {
    return this.records.find((r) => r.externalReference === externalReference) ?? null;
  }
  async list(): Promise<ExternalShiftCloseRecord[]> {
    return this.records;
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
    { companyId: "company-1", branchId: null, userId: "api:key-1", roles: [], permissions: new Set() },
    fn
  );
}

const INPUT: RegisterShiftCloseInput = {
  branchId: "branch-1",
  externalReference: "shift-1",
  date: new Date("2026-09-29"),
  payments: [{ method: "CASH", amount: 119_000 }],
  salesTaxBreakdown: [{ taxType: "IVA", taxRate: 19, taxableBase: 100_000, taxAmount: 19_000 }],
  returns: [],
  expenses: [],
  withdrawals: [],
  advances: [],
  cashExpected: 119_000,
  cashCounted: 119_000,
};

describe("RegisterShiftCloseUseCase", () => {
  it("posts the entry and records POSTED on first attempt", async () => {
    const repo = new FakeExternalShiftCloseRepository();
    const auditRepo = new FakeAuditLogRepository();
    const postShiftClose = { execute: vi.fn().mockResolvedValue({ id: "entry-1", number: 1 }) } as unknown as PostShiftCloseJournalEntryUseCase;
    const useCase = new RegisterShiftCloseUseCase(repo, postShiftClose, new AuditService(auditRepo));

    const result = await withTenantContext(() => useCase.execute(INPUT));

    expect(result.status).toBe("POSTED");
    expect(result.journalEntryIds).toEqual(["entry-1"]);
    expect(postShiftClose.execute).toHaveBeenCalledTimes(1);
    expect(auditRepo.entries.some((e) => e.action === "SHIFT_CLOSE_POSTED")).toBe(true);
  });

  it("does not reprocess (idempotent) when the same externalReference is retried", async () => {
    const repo = new FakeExternalShiftCloseRepository();
    const postShiftClose = { execute: vi.fn().mockResolvedValue({ id: "entry-1", number: 1 }) } as unknown as PostShiftCloseJournalEntryUseCase;
    const useCase = new RegisterShiftCloseUseCase(repo, postShiftClose, new AuditService(new FakeAuditLogRepository()));

    const first = await withTenantContext(() => useCase.execute(INPUT));
    const second = await withTenantContext(() => useCase.execute(INPUT));

    expect(postShiftClose.execute).toHaveBeenCalledTimes(1);
    expect(second).toEqual(first);
    expect(repo.records).toHaveLength(1);
  });

  it("records FAILED (not POSTED) and never throws when accounting posting fails", async () => {
    const repo = new FakeExternalShiftCloseRepository();
    const auditRepo = new FakeAuditLogRepository();
    const postShiftClose = {
      execute: vi.fn().mockRejectedValue(new Error("El comprobante no cuadra: debitos 100 vs creditos 90")),
    } as unknown as PostShiftCloseJournalEntryUseCase;
    const useCase = new RegisterShiftCloseUseCase(repo, postShiftClose, new AuditService(auditRepo));

    const result = await withTenantContext(() => useCase.execute(INPUT));

    expect(result.status).toBe("FAILED");
    expect(result.errorMessage).toContain("no cuadra");
    expect(result.journalEntryIds).toEqual([]);
    expect(auditRepo.entries.some((e) => e.action === "SHIFT_CLOSE_FAILED")).toBe(true);
  });

  it("retries a FAILED attempt (unlike POSTED) and posts normally once the underlying problem is gone", async () => {
    const repo = new FakeExternalShiftCloseRepository();
    const failThenSucceed = vi
      .fn()
      .mockRejectedValueOnce(new Error("fallo temporal (timeout de red)"))
      .mockResolvedValueOnce({ id: "entry-1", number: 1 });
    const postShiftClose = { execute: failThenSucceed } as unknown as PostShiftCloseJournalEntryUseCase;
    const useCase = new RegisterShiftCloseUseCase(repo, postShiftClose, new AuditService(new FakeAuditLogRepository()));

    const retryInput = { ...INPUT, externalReference: "shift-retry" };
    const firstAttempt = await withTenantContext(() => useCase.execute(retryInput));
    expect(firstAttempt.status).toBe("FAILED");

    // Reintento con la MISMA referencia -- como el primero NO quedo POSTED, se vuelve a intentar
    // (y esta vez el mock resuelve bien) en vez de quedar atascado en FAILED para siempre.
    const secondAttempt = await withTenantContext(() => useCase.execute(retryInput));
    expect(secondAttempt.status).toBe("POSTED");
    expect(secondAttempt.id).toBe(firstAttempt.id); // mismo registro, actualizado in-place
    expect(postShiftClose.execute).toHaveBeenCalledTimes(2);
    expect(repo.records).toHaveLength(1); // nunca duplico la fila
  });
});
