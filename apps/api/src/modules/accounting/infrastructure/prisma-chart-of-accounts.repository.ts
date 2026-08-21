import { Prisma } from "@erp/database";
import { prisma } from "../../../shared/prisma/prisma-client";
import { getTenantContext } from "../../../shared/context/request-context";
import { ConflictError, NotFoundError } from "../../../shared/errors/app-error";
import type {
  AccountRecord,
  AccountType,
  CreateAccountData,
  IChartOfAccountsRepository,
  UpdateAccountData,
} from "../domain/chart-of-accounts.repository";

export class PrismaChartOfAccountsRepository implements IChartOfAccountsRepository {
  async create(data: CreateAccountData): Promise<AccountRecord> {
    const level = data.parentId ? (await this.findByIdOrThrow(data.parentId)).level + 1 : 1;
    try {
      const row = await prisma.chartOfAccounts.create({
        data: {
          companyId: getTenantContext().companyId,
          code: data.code,
          name: data.name,
          type: data.type,
          parentId: data.parentId,
          level,
          acceptsEntries: data.acceptsEntries ?? true,
        },
      });
      return this.toRecord(row);
    } catch (err) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
        throw new ConflictError(`Ya existe una cuenta con el codigo ${data.code}`);
      }
      throw err;
    }
  }

  async list(): Promise<AccountRecord[]> {
    const rows = await prisma.chartOfAccounts.findMany({ orderBy: { code: "asc" } });
    return rows.map(this.toRecord);
  }

  async findByCode(code: string): Promise<AccountRecord | null> {
    const row = await prisma.chartOfAccounts.findFirst({ where: { code } });
    return row ? this.toRecord(row) : null;
  }

  async findByIdOrThrow(id: string): Promise<AccountRecord> {
    const row = await prisma.chartOfAccounts.findFirst({ where: { id } });
    if (!row) throw new NotFoundError("ChartOfAccounts", id);
    return this.toRecord(row);
  }

  async upsertByCode(data: CreateAccountData): Promise<AccountRecord> {
    const existing = await this.findByCode(data.code);
    if (existing) {
      // Si el usuario la desactivo a mano desde el catalogo PUC (setActive) pero el motor
      // contable la sigue necesitando para un asiento automatico, se reactiva sola -- mismo
      // criterio que "se crean solas la primera vez que se usan".
      if (!existing.isActive) return this.setActive(existing.id, true);
      return existing;
    }
    return this.create(data);
  }

  async setActive(id: string, isActive: boolean): Promise<AccountRecord> {
    await this.findByIdOrThrow(id);
    const row = await prisma.chartOfAccounts.update({ where: { id }, data: { isActive } });
    return this.toRecord(row);
  }

  async disableDirectEntries(id: string): Promise<AccountRecord> {
    const existing = await this.findByIdOrThrow(id);
    if (!existing.acceptsEntries) return existing;
    const row = await prisma.chartOfAccounts.update({ where: { id }, data: { acceptsEntries: false } });
    return this.toRecord(row);
  }

  async update(id: string, data: UpdateAccountData): Promise<AccountRecord> {
    await this.findByIdOrThrow(id);
    const row = await prisma.chartOfAccounts.update({ where: { id }, data: { name: data.name } });
    return this.toRecord(row);
  }

  private toRecord(row: {
    id: string;
    code: string;
    name: string;
    type: string;
    parentId: string | null;
    level: number;
    isActive: boolean;
    acceptsEntries: boolean;
  }): AccountRecord {
    return {
      id: row.id,
      code: row.code,
      name: row.name,
      type: row.type as AccountType,
      parentId: row.parentId,
      level: row.level,
      isActive: row.isActive,
      acceptsEntries: row.acceptsEntries,
    };
  }
}
