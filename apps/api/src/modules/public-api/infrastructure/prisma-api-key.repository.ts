import { basePrisma } from "@erp/database";
import { prisma } from "../../../shared/prisma/prisma-client";
import { getTenantContext } from "../../../shared/context/request-context";
import { NotFoundError } from "../../../shared/errors/app-error";
import type { ApiKeyRecord, ApiKeyWithCompany, CreateApiKeyData, IApiKeyRepository } from "../domain/api-key.repository";

type ApiKeyRow = {
  id: string;
  name: string;
  keyPrefix: string;
  scopes: string[];
  isActive: boolean;
  lastUsedAt: Date | null;
  createdByUserId: string;
  createdAt: Date;
};

function toRecord(row: ApiKeyRow): ApiKeyRecord {
  return {
    id: row.id,
    name: row.name,
    keyPrefix: row.keyPrefix,
    scopes: row.scopes,
    isActive: row.isActive,
    lastUsedAt: row.lastUsedAt,
    createdByUserId: row.createdByUserId,
    createdAt: row.createdAt,
  };
}

export class PrismaApiKeyRepository implements IApiKeyRepository {
  async create(data: CreateApiKeyData): Promise<ApiKeyRecord> {
    const row = await prisma.apiKey.create({
      data: {
        companyId: getTenantContext().companyId,
        name: data.name,
        scopes: data.scopes,
        createdByUserId: data.createdByUserId,
        keyHash: data.keyHash,
        keyPrefix: data.keyPrefix,
      },
    });
    return toRecord(row);
  }

  async list(): Promise<ApiKeyRecord[]> {
    const rows = await prisma.apiKey.findMany({ orderBy: { createdAt: "desc" } });
    return rows.map(toRecord);
  }

  async findByIdOrThrow(id: string): Promise<ApiKeyRecord> {
    const companyId = getTenantContext().companyId;
    const row = await prisma.apiKey.findFirst({ where: { id, companyId } });
    if (!row) throw new NotFoundError("ApiKey", id);
    return toRecord(row);
  }

  async deactivate(id: string): Promise<ApiKeyRecord> {
    await this.findByIdOrThrow(id);
    const row = await prisma.apiKey.update({ where: { id }, data: { isActive: false } });
    return toRecord(row);
  }

  async findByHashCrossTenant(keyHash: string): Promise<ApiKeyWithCompany | null> {
    const row = await basePrisma.apiKey.findUnique({ where: { keyHash } });
    if (!row) return null;
    return { ...toRecord(row), companyId: row.companyId };
  }

  async touchLastUsed(id: string): Promise<void> {
    await basePrisma.apiKey.update({ where: { id }, data: { lastUsedAt: new Date() } });
  }
}
