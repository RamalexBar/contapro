import type { AuditService } from "../../../../audit/application/audit.service";
import type { ISaleRepository, SaleRecord } from "../../domain/sale.repository";

/**
 * Requiere permiso `sale.cancel`. NOTA (limitacion conocida): no restaura automaticamente el
 * inventario ni el dinero de caja. El modulo de Devoluciones (`modules/pos/return`, iteracion 22)
 * si ajusta stock explicitamente, pero solo aplica sobre ventas `COMPLETED`/`RETURNED_PARTIAL` --
 * a proposito no permite devoluciones sobre una venta ya `CANCELLED` (cancelar y devolver son
 * flujos distintos: cancelar es "la venta nunca debio completarse", devolver es "la venta fue
 * valida pero el cliente trae algo de vuelta"). Anular una venta completada sigue sin una forma
 * de restaurar su inventario en este codebase.
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
