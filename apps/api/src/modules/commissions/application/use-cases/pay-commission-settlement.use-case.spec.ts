import { describe, expect, it, vi } from "vitest";
import { tenantStorage } from "../../../../shared/context/request-context";
import { AuditService } from "../../../audit/application/audit.service";
import type { AuditLogEntry, CreateAuditLogInput, IAuditLogRepository } from "../../../audit/domain/audit-log.repository";
import type { IUserDirectoryRepository, UserSummary } from "../../../rbac/domain/rbac.types";
import type { PostCommissionJournalEntryUseCase } from "../../../accounting/application/use-cases/post-commission-journal-entry.use-case";
import type {
  CommissionSettlementRecord,
  ICommissionSettlementRepository,
  MarkPaidData,
} from "../../domain/commission-settlement.repository";
import { PayCommissionSettlementUseCase } from "./pay-commission-settlement.use-case";

const SETTLEMENT_CALCULATED: CommissionSettlementRecord = {
  id: "settlement-1",
  sellerUserId: "seller-1",
  year: 2026,
  month: 6,
  salesBase: 100_000,
  ratePercent: 5,
  commissionAmount: 5000,
  status: "CALCULATED",
  calculatedAt: new Date(2026, 5, 30),
  paidAt: null,
  journalEntryId: null,
};

const SELLER: UserSummary = { id: "seller-1", email: "seller@demo.com", fullName: "Vendedor Uno", isActive: true, roles: ["CAJERO"] };

class FakeSettlementRepository implements Partial<ICommissionSettlementRepository> {
  constructor(private settlement: CommissionSettlementRecord) {}
  marked: { id: string; data: MarkPaidData }[] = [];

  async findByIdOrThrow(id: string): Promise<CommissionSettlementRecord> {
    if (id !== this.settlement.id) throw new Error("not found");
    return this.settlement;
  }
  async markPaid(id: string, data: MarkPaidData): Promise<CommissionSettlementRecord> {
    this.marked.push({ id, data });
    this.settlement = { ...this.settlement, status: "PAID", paidAt: data.paidAt, journalEntryId: data.journalEntryId };
    return this.settlement;
  }
}

class FakeUserDirectoryRepository implements Partial<IUserDirectoryRepository> {
  async list(): Promise<UserSummary[]> {
    return [SELLER];
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

function makeUseCase(settlement: CommissionSettlementRecord, journalEntryResult: { id: string } | null = { id: "je-1" }) {
  const settlementRepo = new FakeSettlementRepository(settlement);
  const auditRepo = new FakeAuditLogRepository();
  const postCommissionJournalEntry = { execute: vi.fn().mockResolvedValue(journalEntryResult) } as unknown as PostCommissionJournalEntryUseCase;

  const useCase = new PayCommissionSettlementUseCase(
    settlementRepo as unknown as ICommissionSettlementRepository,
    new FakeUserDirectoryRepository() as unknown as IUserDirectoryRepository,
    postCommissionJournalEntry,
    new AuditService(auditRepo)
  );

  return { useCase, settlementRepo, postCommissionJournalEntry };
}

function withTenantContext<T>(fn: () => Promise<T>): Promise<T> {
  return tenantStorage.run(
    { companyId: "company-1", branchId: null, userId: "user-1", roles: [], permissions: new Set() },
    fn
  );
}

describe("PayCommissionSettlementUseCase", () => {
  it("pays a CALCULATED settlement: books the journal entry and marks it PAID", async () => {
    const { useCase, settlementRepo, postCommissionJournalEntry } = makeUseCase(SETTLEMENT_CALCULATED);

    const result = await withTenantContext(() => useCase.execute({ id: "settlement-1", branchId: "branch-1", paymentMethod: "CASH" }));

    expect(postCommissionJournalEntry.execute).toHaveBeenCalledWith(
      expect.objectContaining({ settlementId: "settlement-1", sellerName: "Vendedor Uno", commissionAmount: 5000, paymentMethod: "CASH" })
    );
    expect(result.status).toBe("PAID");
    expect(settlementRepo.marked[0].data.journalEntryId).toBe("je-1");
  });

  it("rejects paying a settlement that is already PAID", async () => {
    const paid: CommissionSettlementRecord = { ...SETTLEMENT_CALCULATED, status: "PAID", journalEntryId: "je-old" };
    const { useCase } = makeUseCase(paid);

    await expect(
      withTenantContext(() => useCase.execute({ id: "settlement-1", branchId: "branch-1", paymentMethod: "CASH" }))
    ).rejects.toThrow(/ya esta en estado/);
  });

  it("rejects paying a settlement that does not exist", async () => {
    const { useCase } = makeUseCase(SETTLEMENT_CALCULATED);

    await expect(
      withTenantContext(() => useCase.execute({ id: "not-a-real-id", branchId: "branch-1", paymentMethod: "CASH" }))
    ).rejects.toThrow(/not found/);
  });
});
