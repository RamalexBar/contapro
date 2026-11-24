import type { AuditService } from "../../../../audit/application/audit.service";
import type { ISaleRepository, SaleRecord } from "../../domain/sale.repository";
import type { IAccountReceivableRepository } from "../../../../collections/domain/account-receivable.repository";
import { ValidationError } from "../../../../../shared/errors/app-error";

/** Estado de la factura electronica de la venta (lo implementa PrismaElectronicInvoiceRepository). */
export interface ISaleInvoiceStatusReader {
  findBySaleId(saleId: string): Promise<{ fullNumber: string; status: string } | null>;
}

/** Una factura en estos estados ya llego (o esta llegando) a la DIAN y no se puede anular. */
const ISSUED_INVOICE_STATUSES = new Set(["ACCEPTED", "PENDING_SUBMISSION"]);

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
  constructor(
    private readonly saleRepo: ISaleRepository,
    private readonly accountReceivableRepo: IAccountReceivableRepository,
    private readonly audit: AuditService,
    private readonly invoiceStatusReader: ISaleInvoiceStatusReader
  ) {}

  async execute(saleId: string, reason: string): Promise<SaleRecord> {
    const existing = await this.saleRepo.findByIdOrThrow(saleId);

    // La DIAN no permite anular una factura electronica ya emitida: se corrige con una nota
    // credito. La devolucion total hace eso y ademas reversa inventario, caja y contabilidad, cosa
    // que anular no hace.
    const invoice = await this.invoiceStatusReader.findBySaleId(saleId);
    if (invoice && ISSUED_INVOICE_STATUSES.has(invoice.status)) {
      throw new ValidationError(
        `La venta #${existing.number} ya tiene la factura electronica ${invoice.fullNumber} emitida y no se puede anular. Registre una devolucion total: genera la nota credito y reversa inventario y contabilidad.`
      );
    }
    if (existing.accountReceivableId) {
      // Lanza ValidationError si la cuenta por cobrar ya tiene pagos registrados (item 31) -- en
      // ese caso la venta NO se cancela, mismo criterio de guarda que CancelPurchaseUseCase con
      // AccountPayable, sin reversar automaticamente.
      await this.accountReceivableRepo.cancel(existing.accountReceivableId);
    }

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
