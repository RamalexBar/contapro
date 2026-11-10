import type { CreateProductInput } from "@erp/shared-types";
import type { AuditService } from "../../../../audit/application/audit.service";
import type { IProductRepository } from "../../domain/product.repository";
import type { Product } from "../../domain/product.entity";
import type { PostInventoryJournalEntryUseCase } from "../../../../accounting/application/use-cases/post-inventory-journal-entry.use-case";

export class CreateProductUseCase {
  constructor(
    private readonly repo: IProductRepository,
    private readonly audit: AuditService,
    /** Asiento de las existencias iniciales (Debito 1435 / Credito 3115). Opcional para los specs. */
    private readonly postInventoryEntry?: PostInventoryJournalEntryUseCase
  ) {}

  async execute(input: CreateProductInput, branchId: string): Promise<Product> {
    const product = await this.repo.create({
      sku: input.sku,
      name: input.name,
      description: input.description,
      location: input.location,
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

    if (input.initialStock > 0) {
      await this.postInventoryEntry?.execute({
        kind: "OPENING",
        amount: input.initialStock * input.currentCost,
        date: new Date(),
        branchId,
        sourceType: "Product",
        sourceId: product.id,
        description: `Existencias iniciales: ${input.initialStock} x ${input.name}`,
      });
    }

    return product;
  }
}
