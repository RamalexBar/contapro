import type { RegisterExternalExpenseInput } from "@erp/shared-types";
import { getTenantContext } from "../../../../shared/context/request-context";
import { ValidationError } from "../../../../shared/errors/app-error";
import type { IExpenseCategoryRepository } from "../../../expenses/domain/expense-category.repository";
import type { CreateExpenseUseCase } from "../../../expenses/application/use-cases/create-expense.use-case";

export interface ExternalExpenseResult {
  id: string;
  total: number;
  status: string;
}

/**
 * Capa delgada sobre CreateExpenseUseCase (modulo expenses) -- se contabiliza y se paga en el
 * mismo momento, sin cuenta por pagar (ver create-expense.use-case.ts). El POS manda el `code` de
 * la categoria (configurado de antemano por el contador con su cuenta PUC), no un id interno de
 * Contapro, mismo criterio que los conceptos de shift-close.
 */
export class RegisterExternalExpenseUseCase {
  constructor(
    private readonly categoryRepo: IExpenseCategoryRepository,
    private readonly createExpense: CreateExpenseUseCase
  ) {}

  async execute(input: RegisterExternalExpenseInput): Promise<ExternalExpenseResult> {
    const category = await this.categoryRepo.findByCode(input.categoryCode);
    if (!category) {
      throw new ValidationError(`No existe una categoria de gasto con el codigo "${input.categoryCode}"`);
    }
    if (!category.isActive) {
      throw new ValidationError(`La categoria de gasto ${category.code} esta inactiva`);
    }

    const userId = getTenantContext().userId;
    const expense = await this.createExpense.execute({
      branchId: input.branchId,
      expenseCategoryId: category.id,
      payeeName: input.payeeName,
      description: input.description,
      date: input.date,
      subtotal: input.subtotal,
      taxTotal: input.taxTotal,
      total: input.total,
      paymentMethod: input.paymentMethod,
      costCenterId: input.costCenterId,
      createdByUserId: userId,
    });

    return { id: expense.id, total: expense.total, status: expense.status };
  }
}
