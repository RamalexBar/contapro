import type { CreateProductInput } from "@erp/shared-types";
import type { AuditService } from "../../../../audit/application/audit.service";
import type { IProductRepository } from "../../domain/product.repository";
import type { Product } from "../../domain/product.entity";

export class CreateProductUseCase {
  constructor(private readonly repo: IProductRepository, private readonly audit: AuditService) {}

  async execute(input: CreateProductInput, branchId: string): Promise<Product> {
    const product = await this.repo.create({
      sku: input.sku,
      name: input.name,
      description: input.description,
      categoryId: input.categoryId,
      brandId: input.brandId,
      unit: input.unit,
      currentCost: input.currentCost,
      currentPrice: input.currentPrice,
      taxRate: input.taxRate,
      barcode: input.barcode,
      branchId,
      initialStock: input.initialStock,
      minStock: input.minStock,
      maxStock: input.maxStock,
    });

    await this.audit.record({
      action: "PRODUCT_CREATED",
      entityType: "Product",
      entityId: product.id,
      description: `Producto creado: ${input.name} (SKU ${input.sku})`,
    });

    return product;
  }
}
