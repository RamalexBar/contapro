import { addDays, calculateTax, round2 } from "@erp/shared-utils";
import type { AuditService } from "../../../audit/application/audit.service";
import type { CreateSaleUseCase } from "../../../pos/sale/application/use-cases/create-sale.use-case";
import type { IProductRepository } from "../../../inventory/product/domain/product.repository";
import type { IPriceListRepository } from "../../../inventory/price-list/domain/price-list.repository";
import { resolveEffectivePrice } from "../../../inventory/price-list/application/resolve-effective-price";
import { calculateNextRunDate } from "../calculate-next-run-date";
import type { IRecurringInvoiceRepository, RecurringInvoiceRecord } from "../../domain/recurring-invoice.repository";

/**
 * Caso de uso del poller (item 36 de docs/ALCANCE.md, mirror de RunCollectionsRemindersUseCase:
 * un fallo en una plantilla no debe frenar a las demas, cada intento queda auditado y con su
 * propio RecurringInvoiceRun). Genera una venta real a credito (`createSaleUseCase`, mismo caso
 * de uso que `POST /sales`) por cada plantilla con `nextRunDate <= hoy` -- la factura electronica
 * DIAN sale gratis, ya esta invocada dentro de CreateSaleUseCase.execute().
 *
 * El total de la venta (usado como monto del pago CREDIT, que CreateSaleUseCase exige que cubra
 * el neto a cobrar) se precalcula aqui replicando el precio efectivo por item (lista de precios
 * si la plantilla tiene una asignada, igual que resolveEffectivePrice) + IVA -- sin descuento
 * (las plantillas recurrentes no soportan discountPercent, ver decision de alcance en el plan del
 * item 36: un precio especial se logra con una lista de precios dedicada, no con un %descuento
 * ad-hoc en un job desatendido).
 */
export class RunRecurringInvoicesUseCase {
  constructor(
    private readonly repo: IRecurringInvoiceRepository,
    private readonly productRepo: IProductRepository,
    private readonly priceListRepo: IPriceListRepository,
    private readonly createSaleUseCase: CreateSaleUseCase,
    private readonly audit: AuditService
  ) {}

  async execute(): Promise<void> {
    const due = await this.repo.listDue(new Date());

    for (const invoice of due) {
      try {
        const sale = await this.createSale(invoice);

        await this.repo.recordRun({
          recurringInvoiceId: invoice.id,
          runDate: new Date(),
          status: "SUCCESS",
          saleId: sale.id,
        });
        await this.repo.advanceNextRun(invoice.id, {
          nextRunDate: calculateNextRunDate(invoice.dayOfMonth, invoice.nextRunDate, "advance"),
          lastRunDate: new Date(),
        });
        await this.audit.record({
          action: "RECURRING_INVOICE_RUN_SUCCEEDED",
          entityType: "RecurringInvoice",
          entityId: invoice.id,
          description: `Venta #${sale.number} generada automaticamente por la plantilla ${invoice.name}`,
        });
      } catch (err) {
        await this.repo.recordRun({
          recurringInvoiceId: invoice.id,
          runDate: new Date(),
          status: "FAILED",
          errorMessage: (err as Error).message,
        });
        await this.audit.record({
          action: "RECURRING_INVOICE_RUN_FAILED",
          entityType: "RecurringInvoice",
          entityId: invoice.id,
          description: `Fallo la facturacion automatica de ${invoice.name}: ${(err as Error).message}`,
        });
      }
    }
  }

  private async createSale(invoice: RecurringInvoiceRecord) {
    let netTotal = 0;
    for (const item of invoice.items) {
      const product = await this.productRepo.findByIdOrThrow(item.productId);
      const unitPrice = await resolveEffectivePrice(
        this.priceListRepo,
        invoice.priceListId,
        item.productId,
        product.toProps.currentPrice
      );
      const lineSubtotal = round2(unitPrice * item.quantity);
      const taxAmount = calculateTax(lineSubtotal, product.toProps.taxRate);
      netTotal = round2(netTotal + lineSubtotal + taxAmount);
    }

    return this.createSaleUseCase.execute({
      branchId: invoice.branchId,
      customerId: invoice.customerId,
      items: invoice.items.map((item) => ({ productId: item.productId, quantity: item.quantity, discountPercent: 0 })),
      payments: [{ method: "CREDIT", amount: netTotal }],
      withholdings: [],
      dueDate: addDays(new Date(), invoice.dueDays),
      currency: "COP",
      exchangeRate: 1,
      priceListId: invoice.priceListId ?? undefined,
    });
  }
}
