import type { AuditService } from "../../../../audit/application/audit.service";
import type { IProductRepository } from "../../domain/product.repository";
import type { Product } from "../../domain/product.entity";

export interface UpdateProductPriceInput {
  productId: string;
  newPrice?: number;
  newCost?: number;
}

/**
 * Regla de negocio critica del spec: "los precios NO podran ser modificados por cajeros;
 * solo Administrador, Propietario o usuarios autorizados". La ruta HTTP exige el permiso
 * `product.price.update`/`product.cost.update` (ver product.routes.ts); este caso de uso,
 * ademas, deja rastro inmutable en AuditLog de cada cambio (precio y/o costo anteriores).
 */
export class UpdateProductPriceUseCase {
  constructor(private readonly productRepo: IProductRepository, private readonly audit: AuditService) {}

  async execute(input: UpdateProductPriceInput): Promise<Product> {
    const product = await this.productRepo.findByIdOrThrow(input.productId);
    const oldPrice = product.currentPrice;
    const oldCost = product.currentCost;

    product.updatePrice(input.newPrice, input.newCost);
    const saved = await this.productRepo.savePriceAndCost(product);

    if (input.newPrice !== undefined) {
      await this.audit.record({
        action: "PRODUCT_PRICE_CHANGED",
        entityType: "Product",
        entityId: product.id,
        description: `Precio cambiado de ${oldPrice} a ${input.newPrice}`,
        metadata: { oldPrice, newPrice: input.newPrice },
      });
    }
    if (input.newCost !== undefined) {
      await this.audit.record({
        action: "PRODUCT_COST_CHANGED",
        entityType: "Product",
        entityId: product.id,
        description: `Costo cambiado de ${oldCost} a ${input.newCost}`,
        metadata: { oldCost, newCost: input.newCost },
      });
    }

    return saved;
  }
}
