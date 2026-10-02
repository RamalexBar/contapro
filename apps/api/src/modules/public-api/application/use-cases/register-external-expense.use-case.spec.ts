import { describe, expect, it, vi } from "vitest";
import { tenantStorage } from "../../../../shared/context/request-context";
import { ValidationError } from "../../../../shared/errors/app-error";
import type { ExpenseCategoryRecord, IExpenseCategoryRepository } from "../../../expenses/domain/expense-category.repository";
import type { CreateExpenseUseCase } from "../../../expenses/application/use-cases/create-expense.use-case";
import { RegisterExternalExpenseUseCase } from "./register-external-expense.use-case";
import type { RegisterExternalExpenseInput } from "@erp/shared-types";

function withTenantContext<T>(fn: () => Promise<T>): Promise<T> {
  return tenantStorage.run(
    { companyId: "company-1", branchId: null, userId: "api:key-1", roles: [], permissions: new Set() },
    fn
  );
}

const CATEGORY: ExpenseCategoryRecord = { id: "category-1", code: "SERVICIOS", name: "Servicios publicos", accountCode: "5135", isActive: true };

function makeInput(overrides: Partial<RegisterExternalExpenseInput> = {}): RegisterExternalExpenseInput {
  return {
    branchId: "branch-1",
    categoryCode: "SERVICIOS",
    payeeName: "EPM",
    date: new Date("2026-10-02"),
    subtotal: 50_000,
    taxTotal: 0,
    total: 50_000,
    paymentMethod: "CASH",
    ...overrides,
  };
}

describe("RegisterExternalExpenseUseCase", () => {
  it("resolves the category by code and delegates to CreateExpenseUseCase", async () => {
    const categoryRepo = { findByCode: vi.fn().mockResolvedValue(CATEGORY) } as unknown as IExpenseCategoryRepository;
    const createExpense = {
      execute: vi.fn().mockResolvedValue({ id: "expense-1", total: 50_000, status: "REGISTERED" }),
    } as unknown as CreateExpenseUseCase;
    const useCase = new RegisterExternalExpenseUseCase(categoryRepo, createExpense);

    const result = await withTenantContext(() => useCase.execute(makeInput()));

    expect(createExpense.execute).toHaveBeenCalledWith(
      expect.objectContaining({ branchId: "branch-1", expenseCategoryId: "category-1", createdByUserId: "api:key-1" })
    );
    expect(result).toEqual({ id: "expense-1", total: 50_000, status: "REGISTERED" });
  });

  it("rejects an unknown category code", async () => {
    const categoryRepo = { findByCode: vi.fn().mockResolvedValue(null) } as unknown as IExpenseCategoryRepository;
    const createExpense = { execute: vi.fn() } as unknown as CreateExpenseUseCase;
    const useCase = new RegisterExternalExpenseUseCase(categoryRepo, createExpense);

    await expect(withTenantContext(() => useCase.execute(makeInput()))).rejects.toBeInstanceOf(ValidationError);
    expect(createExpense.execute).not.toHaveBeenCalled();
  });

  it("rejects an inactive category", async () => {
    const categoryRepo = {
      findByCode: vi.fn().mockResolvedValue({ ...CATEGORY, isActive: false }),
    } as unknown as IExpenseCategoryRepository;
    const createExpense = { execute: vi.fn() } as unknown as CreateExpenseUseCase;
    const useCase = new RegisterExternalExpenseUseCase(categoryRepo, createExpense);

    await expect(withTenantContext(() => useCase.execute(makeInput()))).rejects.toBeInstanceOf(ValidationError);
    expect(createExpense.execute).not.toHaveBeenCalled();
  });
});
