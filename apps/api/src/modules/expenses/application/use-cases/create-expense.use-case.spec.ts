import { describe, expect, it, vi } from "vitest";
import { tenantStorage } from "../../../../shared/context/request-context";
import { AuditService } from "../../../audit/application/audit.service";
import type { AuditLogEntry, CreateAuditLogInput, IAuditLogRepository } from "../../../audit/domain/audit-log.repository";
import type {
  ExpenseJournalEntryInput,
  PostExpenseJournalEntryUseCase,
} from "../../../accounting/application/use-cases/post-expense-journal-entry.use-case";
import type { CostCenterRecord, ICostCenterRepository } from "../../../accounting/domain/cost-center.repository";
import type { ExpenseCategoryRecord, IExpenseCategoryRepository } from "../../domain/expense-category.repository";
import type { CreateExpenseData, ExpenseRecord, IExpenseRepository } from "../../domain/expense.repository";
import { CreateExpenseUseCase } from "./create-expense.use-case";

const CATEGORY: ExpenseCategoryRecord = {
  id: "category-1",
  code: "ARRIENDO",
  name: "Arrendamientos",
  accountCode: "5120",
  isActive: true,
};

class FakeExpenseCategoryRepository implements Partial<IExpenseCategoryRepository> {
  constructor(private readonly category: ExpenseCategoryRecord = CATEGORY) {}
  async findByIdOrThrow(id: string): Promise<ExpenseCategoryRecord> {
    if (id !== this.category.id) throw new Error("not found");
    return this.category;
  }
}

const COST_CENTER: CostCenterRecord = { id: "cc-1", code: "SUC-NORTE", name: "Sucursal Norte", isActive: true };

class FakeCostCenterRepository implements Partial<ICostCenterRepository> {
  constructor(private readonly costCenter: CostCenterRecord = COST_CENTER) {}
  async findByIdOrThrow(id: string): Promise<CostCenterRecord> {
    if (id !== this.costCenter.id) throw new Error("not found");
    return this.costCenter;
  }
}

class FakeExpenseRepository implements Partial<IExpenseRepository> {
  created: CreateExpenseData[] = [];
  async create(data: CreateExpenseData): Promise<ExpenseRecord> {
    this.created.push(data);
    return {
      id: "expense-1",
      branchId: data.branchId,
      expenseCategoryId: data.expenseCategoryId,
      payeeName: data.payeeName,
      description: data.description ?? null,
      date: data.date,
      subtotal: data.subtotal,
      taxTotal: data.taxTotal,
      total: data.total,
      paymentMethod: data.paymentMethod,
      costCenterId: data.costCenterId ?? null,
      status: "REGISTERED",
      journalEntryId: null,
      createdByUserId: data.createdByUserId,
      createdAt: new Date("2026-08-05"),
    };
  }
  async setJournalEntryId(): Promise<void> {
    return;
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

function makeUseCase(category?: ExpenseCategoryRecord, costCenter?: CostCenterRecord) {
  const expenseRepo = new FakeExpenseRepository();
  const categoryRepo = new FakeExpenseCategoryRepository(category);
  const costCenterRepo = new FakeCostCenterRepository(costCenter);
  const postExpenseJournalEntry = { execute: vi.fn().mockResolvedValue(null) } as unknown as PostExpenseJournalEntryUseCase & {
    execute: (input: ExpenseJournalEntryInput) => Promise<null>;
  };
  const auditRepo = new FakeAuditLogRepository();

  const useCase = new CreateExpenseUseCase(
    expenseRepo as unknown as IExpenseRepository,
    categoryRepo as unknown as IExpenseCategoryRepository,
    postExpenseJournalEntry,
    costCenterRepo as unknown as ICostCenterRepository,
    new AuditService(auditRepo)
  );

  return { useCase, expenseRepo, postExpenseJournalEntry };
}

const BASE_INPUT: CreateExpenseData = {
  branchId: "branch-1",
  expenseCategoryId: CATEGORY.id,
  payeeName: "Arrendador X",
  date: new Date("2026-08-05"),
  subtotal: 500_000,
  taxTotal: 0,
  total: 500_000,
  paymentMethod: "CASH",
  createdByUserId: "user-1",
};

describe("CreateExpenseUseCase", () => {
  it("registers an expense and posts it with the category's account code/name", async () => {
    const { useCase, postExpenseJournalEntry } = makeUseCase();

    const expense = await withTenantContext(() => useCase.execute(BASE_INPUT));

    expect(expense.status).toBe("REGISTERED");
    expect(postExpenseJournalEntry.execute).toHaveBeenCalledWith(
      expect.objectContaining({
        expenseAccountCode: CATEGORY.accountCode,
        expenseAccountName: CATEGORY.name,
        total: 500_000,
        paymentMethod: "CASH",
      })
    );
  });

  it("rejects an inactive category", async () => {
    const { useCase } = makeUseCase({ ...CATEGORY, isActive: false });

    await expect(withTenantContext(() => useCase.execute(BASE_INPUT))).rejects.toThrow(/inactiva/);
  });

  it("rejects when subtotal + taxTotal doesn't match total", async () => {
    const { useCase } = makeUseCase();

    await expect(withTenantContext(() => useCase.execute({ ...BASE_INPUT, total: 999_999 }))).rejects.toThrow(
      /no coincide con subtotal/
    );
  });
});

describe("CreateExpenseUseCase — centro de costo (item 34 de docs/ALCANCE.md)", () => {
  it("passes a valid, active cost center through to the expense and the journal entry", async () => {
    const { useCase, expenseRepo, postExpenseJournalEntry } = makeUseCase();

    const expense = await withTenantContext(() => useCase.execute({ ...BASE_INPUT, costCenterId: COST_CENTER.id }));

    expect(expense.costCenterId).toBe(COST_CENTER.id);
    expect(expenseRepo.created[0].costCenterId).toBe(COST_CENTER.id);
    expect(postExpenseJournalEntry.execute).toHaveBeenCalledWith(
      expect.objectContaining({ costCenterId: COST_CENTER.id })
    );
  });

  it("rejects an inactive cost center", async () => {
    const { useCase } = makeUseCase(undefined, { ...COST_CENTER, isActive: false });

    await expect(
      withTenantContext(() => useCase.execute({ ...BASE_INPUT, costCenterId: COST_CENTER.id }))
    ).rejects.toThrow(/inactivo/);
  });

  it("omitting costCenterId behaves as before this feature existed", async () => {
    const { useCase, expenseRepo } = makeUseCase();

    const expense = await withTenantContext(() => useCase.execute(BASE_INPUT));

    expect(expense.costCenterId).toBeNull();
    expect(expenseRepo.created[0].costCenterId).toBeUndefined();
  });
});
