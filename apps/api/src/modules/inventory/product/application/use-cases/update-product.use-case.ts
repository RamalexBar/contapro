import type { UpdateProductInput } from "@erp/shared-types";
import type { AuditService } from "../../../../audit/application/audit.service";
import type { IProductRepository } from "../../domain/product.repository";
import type { Product } from "../../domain/product.entity";

export class UpdateProductUseCase {
  constructor(private readonly repo: IProductRepository, private readonly audit: AuditService) {}

  async execute(productId: string, input: UpdateProductInput): Promise<Product> {
    const product = await this.repo.updateBasicInfo(productId, input);

    await this.audit.record({
      action: "PRODUCT_UPDATED",
      entityType: "Product",
      entityId: productId,
      description: "Datos generales del producto actualizados",
      metadata: input,
    });

    return product;
  }
}
