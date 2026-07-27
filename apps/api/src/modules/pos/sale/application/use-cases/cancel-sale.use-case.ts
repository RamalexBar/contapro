import type { AuditService } from "../../../../audit/application/audit.service";
import type { ISaleRepository, SaleRecord } from "../../domain/sale.repository";

/**
 * Requiere permiso `sale.cancel`. NOTA (limitacion conocida de esta iteracion): no restaura
 * automaticamente el inventario ni el dinero de caja; para eso se debe usar el modulo de
 * Devoluciones (Return) sobre la venta ya anulada, que si ajusta stock explicitamente.
 */
export class CancelSaleUseCase {
  constructor(private readonly saleRepo: ISaleRepository, private readonly audit: AuditService) {}

  async execute(saleId: string, reason: string): Promise<SaleRecord> {
    const sale = await this.saleRepo.cancel(saleId, reason);
    await this.audit.record({
      action: "SALE_CANCELLED",
      entityType: "Sale",
      entityId: sale.id,
      description: `Venta #${sale.number} anulada: ${reason}`,
    });
    return sale;
  }
}
