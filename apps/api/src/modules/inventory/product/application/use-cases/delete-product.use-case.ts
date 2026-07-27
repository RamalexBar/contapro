import type { AuditService } from "../../../../audit/application/audit.service";
import type { IProductRepository } from "../../domain/product.repository";

/**
 * Requiere permiso `product.delete` (NO lo tiene el Cajero por defecto). Se implementa como
 * borrado logico (isActive=false) para preservar la integridad referencial con ventas/kardex
 * historicos, tal como exige la trazabilidad de auditoria.
 */
export class DeleteProductUseCase {
  constructor(private readonly productRepo: IProductRepository, private readonly audit: AuditService) {}

  async execute(productId: string): Promise<void> {
    const product = await this.productRepo.findByIdOrThrow(productId);
    await this.productRepo.softDelete(productId);
    await this.audit.record({
      action: "PRODUCT_DELETED",
      entityType: "Product",
      entityId: product.id,
      description: `Producto eliminado (baja logica)`,
    });
  }
}
