import { Prisma } from "@erp/database";
import { prisma } from "../../../../shared/prisma/prisma-client";
import { getTenantContext } from "../../../../shared/context/request-context";
import { ConflictError, NotFoundError } from "../../../../shared/errors/app-error";
import { Product } from "../domain/product.entity";
import type { CreateProductData, IProductRepository, ProductListItem } from "../domain/product.repository";

type ProductRow = {
  id: string;
  companyId: string;
  sku: string;
  name: string;
  description: string | null;
  categoryId: string | null;
  brandId: string | null;
  unit: string;
  currentCost: Prisma.Decimal;
  currentPrice: Prisma.Decimal;
  taxRate: Prisma.Decimal;
  isActive: boolean;
};

function toEntity(row: ProductRow): Product {
  return Product.fromPersistence({
    id: row.id,
    companyId: row.companyId,
    sku: row.sku,
    name: row.name,
    description: row.description,
    categoryId: row.categoryId,
    brandId: row.brandId,
    unit: row.unit,
    currentCost: Number(row.currentCost),
    currentPrice: Number(row.currentPrice),
    taxRate: Number(row.taxRate),
    isActive: row.isActive,
  });
}

export class PrismaProductRepository implements IProductRepository {
  async create(data: CreateProductData): Promise<Product> {
    const companyId = getTenantContext().companyId;
    try {
      const row = await prisma.$transaction(async (tx) => {
        const product = await tx.product.create({
          data: {
            companyId,
            sku: data.sku,
            name: data.name,
            description: data.description,
            categoryId: data.categoryId,
            brandId: data.brandId,
            unit: data.unit ?? "UN",
            currentCost: data.currentCost,
            currentPrice: data.currentPrice,
            taxRate: data.taxRate ?? 19,
          },
        });

        if (data.barcode) {
          await tx.barcode.create({ data: { companyId, productId: product.id, code: data.barcode } });
        }

        await tx.productBranchStock.create({
          data: {
            companyId,
            productId: product.id,
            branchId: data.branchId,
            quantity: data.initialStock,
            minStock: data.minStock,
            maxStock: data.maxStock,
          },
        });

        if (data.initialStock > 0) {
          await tx.stockMovement.create({
            data: {
              companyId,
              branchId: data.branchId,
              productId: product.id,
              type: "ADJUSTMENT_IN",
              quantity: data.initialStock,
              unitCost: data.currentCost,
              referenceType: "ProductCreation",
              createdByUserId: getTenantContext().userId,
            },
          });
        }

        return product;
      });
      return toEntity(row);
    } catch (err) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
        throw new ConflictError(`Ya existe un producto con ese SKU o codigo de barras`);
      }
      throw err;
    }
  }

  async findById(id: string): Promise<Product | null> {
    const row = await prisma.product.findFirst({ where: { id } });
    return row ? toEntity(row) : null;
  }

  async findByIdOrThrow(id: string): Promise<Product> {
    const product = await this.findById(id);
    if (!product) throw new NotFoundError("Product", id);
    return product;
  }

  async findByBarcode(code: string): Promise<Product | null> {
    const companyId = getTenantContext().companyId;
    const barcode = await prisma.barcode.findFirst({ where: { code, companyId } });
    if (!barcode) return null;
    return this.findById(barcode.productId);
  }

  async list(search?: string): Promise<ProductListItem[]> {
    const rows = await prisma.product.findMany({
      where: {
        isActive: true,
        ...(search ? { name: { contains: search, mode: "insensitive" } } : {}),
      },
      include: { barcodes: true },
      orderBy: { name: "asc" },
      take: 100,
    });
    return rows.map((row) => ({
      id: row.id,
      sku: row.sku,
      name: row.name,
      categoryId: row.categoryId,
      brandId: row.brandId,
      currentPrice: Number(row.currentPrice),
      currentCost: Number(row.currentCost),
      isActive: row.isActive,
      barcodes: row.barcodes.map((b) => b.code),
    }));
  }

  async updateBasicInfo(
    id: string,
    data: { name?: string; description?: string; categoryId?: string | null; brandId?: string | null; unit?: string }
  ): Promise<Product> {
    await this.assertBelongsToCompany(id);
    const row = await prisma.product.update({ where: { id }, data });
    return toEntity(row);
  }

  async savePriceAndCost(product: Product): Promise<Product> {
    const props = product.toProps;
    await this.assertBelongsToCompany(props.id);
    const row = await prisma.product.update({
      where: { id: props.id },
      data: { currentPrice: props.currentPrice, currentCost: props.currentCost },
    });
    return toEntity(row);
  }

  async updateBarcode(id: string, code: string, type = "EAN13"): Promise<void> {
    await this.assertBelongsToCompany(id);
    const companyId = getTenantContext().companyId;
    try {
      const existing = await prisma.barcode.findFirst({ where: { productId: id } });
      if (existing) {
        await prisma.barcode.update({ where: { id: existing.id }, data: { code, type } });
      } else {
        await prisma.barcode.create({ data: { companyId, productId: id, code, type } });
      }
    } catch (err) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
        throw new ConflictError(`El codigo de barras ${code} ya esta en uso`);
      }
      throw err;
    }
  }

  async softDelete(id: string): Promise<void> {
    await this.assertBelongsToCompany(id);
    await prisma.product.update({ where: { id }, data: { isActive: false } });
  }

  /** Convencion obligatoria antes de update/delete por id (ver shared/prisma/README.md). */
  private async assertBelongsToCompany(id: string): Promise<void> {
    const existing = await prisma.product.findFirst({ where: { id } });
    if (!existing) throw new NotFoundError("Product", id);
  }
}
