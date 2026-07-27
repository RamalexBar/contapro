import type { AuditService } from "../../../../audit/application/audit.service";
import type { IProductRepository } from "../../domain/product.repository";

/** Requiere permiso `product.barcode.update` (NO lo tiene el Cajero por defecto). */
export class UpdateProductBarcodeUseCase {
  constructor(private readonly productRepo: IProductRepository, private readonly audit: AuditService) {}

  async execute(productId: string, code: string, type?: string): Promise<void> {
    await this.productRepo.updateBarcode(productId, code, type);
    await this.audit.record({
      action: "PRODUCT_BARCODE_CHANGED",
      entityType: "Product",
      entityId: productId,
      description: `Codigo de barras actualizado a ${code}`,
    });
  }
}
