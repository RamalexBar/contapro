import { Prisma } from "@erp/database";
import { prisma } from "../../../../shared/prisma/prisma-client";
import { getTenantContext } from "../../../../shared/context/request-context";
import { ConflictError, NotFoundError } from "../../../../shared/errors/app-error";
import type {
  CreatePriceListData,
  IPriceListRepository,
  PriceListRecord,
  ProductPriceRecord,
  UpdatePriceListData,
} from "../domain/price-list.repository";

export class PrismaPriceListRepository implements IPriceListRepository {
  async create(data: CreatePriceListData): Promise<PriceListRecord> {
    try {
      const row = await prisma.priceList.create({
        data: {
          companyId: getTenantContext().companyId,
          code: data.code,
          name: data.name,
        },
      });
      return this.toRecord(row);
    } catch (err) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
        throw new ConflictError(`Ya existe una lista de precios con el codigo ${data.code}`);
      }
      throw err;
    }
  }

  async list(): Promise<PriceListRecord[]> {
    const rows = await prisma.priceList.findMany({ orderBy: { code: "asc" } });
    return rows.map(this.toRecord);
  }

  async findByIdOrThrow(id: string): Promise<PriceListRecord> {
    const companyId = getTenantContext().companyId;
    const row = await prisma.priceList.findFirst({ where: { id, companyId } });
    if (!row) throw new NotFoundError("PriceList", id);
    return this.toRecord(row);
  }

  async update(id: string, data: UpdatePriceListData): Promise<PriceListRecord> {
    await this.findByIdOrThrow(id);
    const row = await prisma.priceList.update({ where: { id }, data: { name: data.name } });
    return this.toRecord(row);
  }

  async deactivate(id: string): Promise<PriceListRecord> {
    await this.findByIdOrThrow(id);
    const row = await prisma.priceList.update({ where: { id }, data: { isActive: false } });
    return this.toRecord(row);
  }

  async listProductPrices(priceListId: string): Promise<ProductPriceRecord[]> {
    await this.findByIdOrThrow(priceListId);
    const rows = await prisma.productPriceListEntry.findMany({ where: { priceListId } });
    return rows.map((r) => ({ productId: r.productId, price: Number(r.price) }));
  }

  async upsertProductPrice(priceListId: string, productId: string, price: number): Promise<ProductPriceRecord> {
    await this.findByIdOrThrow(priceListId);
    const row = await prisma.productPriceListEntry.upsert({
      where: { priceListId_productId: { priceListId, productId } },
      create: { priceListId, productId, price },
      update: { price },
    });
    return { productId: row.productId, price: Number(row.price) };
  }

  async removeProductPrice(priceListId: string, productId: string): Promise<void> {
    await this.findByIdOrThrow(priceListId);
    await prisma.productPriceListEntry.deleteMany({ where: { priceListId, productId } });
  }

  async findProductPrice(priceListId: string, productId: string): Promise<number | null> {
    const row = await prisma.productPriceListEntry.findUnique({
      where: { priceListId_productId: { priceListId, productId } },
    });
    return row ? Number(row.price) : null;
  }

  private toRecord(row: { id: string; code: string; name: string; isActive: boolean }): PriceListRecord {
    return { id: row.id, code: row.code, name: row.name, isActive: row.isActive };
  }
}
