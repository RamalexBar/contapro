import { Prisma } from "@erp/database";
import { prisma } from "../../../shared/prisma/prisma-client";
import { getTenantContext } from "../../../shared/context/request-context";
import { ConflictError, NotFoundError } from "../../../shared/errors/app-error";
import type {
  CreateExpenseCategoryData,
  ExpenseCategoryRecord,
  IExpenseCategoryRepository,
  UpdateExpenseCategoryData,
} from "../domain/expense-category.repository";

export class PrismaExpenseCategoryRepository implements IExpenseCategoryRepository {
  async create(data: CreateExpenseCategoryData): Promise<ExpenseCategoryRecord> {
    try {
      const row = await prisma.expenseCategory.create({
        data: {
          companyId: getTenantContext().companyId,
          code: data.code,
          name: data.name,
          accountCode: data.accountCode,
        },
      });
      return this.toRecord(row);
    } catch (err) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
        throw new ConflictError(`Ya existe una categoria de gasto con el codigo ${data.code}`);
      }
      throw err;
    }
  }

  async list(): Promise<ExpenseCategoryRecord[]> {
    const rows = await prisma.expenseCategory.findMany({ orderBy: { code: "asc" } });
    return rows.map(this.toRecord);
  }

  async findByIdOrThrow(id: string): Promise<ExpenseCategoryRecord> {
    const companyId = getTenantContext().companyId;
    const row = await prisma.expenseCategory.findFirst({ where: { id, companyId } });
    if (!row) throw new NotFoundError("ExpenseCategory", id);
    return this.toRecord(row);
  }

  async update(id: string, data: UpdateExpenseCategoryData): Promise<ExpenseCategoryRecord> {
    await this.findByIdOrThrow(id);
    const row = await prisma.expenseCategory.update({
      where: { id },
      data: { name: data.name, accountCode: data.accountCode },
    });
    return this.toRecord(row);
  }

  async deactivate(id: string): Promise<ExpenseCategoryRecord> {
    await this.findByIdOrThrow(id);
    const row = await prisma.expenseCategory.update({ where: { id }, data: { isActive: false } });
    return this.toRecord(row);
  }

  private toRecord(row: {
    id: string;
    code: string;
    name: string;
    accountCode: string;
    isActive: boolean;
  }): ExpenseCategoryRecord {
    return { id: row.id, code: row.code, name: row.name, accountCode: row.accountCode, isActive: row.isActive };
  }
}
