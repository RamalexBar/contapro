import type { CreateSaleInput } from "@erp/shared-types";
import { applyDiscount, calculateTax, round2 } from "@erp/shared-utils";
import { getTenantContext } from "../../../../../shared/context/request-context";
import { ValidationError } from "../../../../../shared/errors/app-error";
import type { AuditService } from "../../../../audit/application/audit.service";
import type { PostSaleJournalEntryUseCase } from "../../../../accounting/application/use-cases/post-sale-journal-entry.use-case";
import type { IProductRepository } from "../../../../inventory/product/domain/product.repository";
import type { ComputedSaleItem, ISaleRepository, SaleRecord } from "../../domain/sale.repository";
import type { IDiscountLimitRepository } from "../../domain/discount-limit.repository";

/**
 * Regla de negocio critica del spec: cada cajero tiene un % maximo de descuento. Si una venta
 * intenta aplicar mas, la venta NO se completa: queda en PENDING_AUTHORIZATION hasta que un
 * supervisor/admin la autorice (ver authorize-discount.use-case.ts).
 *
 * Usuarios con el permiso `discount.authorize` (supervisor/admin) pueden vender sin limite,
 * ya que ellos mismos podrian autorizarse.
 */
export class CreateSaleUseCase {
  constructor(
    private readonly saleRepo: ISaleRepository,
    private readonly productRepo: IProductRepository,
    private readonly discountLimitRepo: IDiscountLimitRepository,
    private readonly postSaleJournalEntry: PostSaleJournalEntryUseCase,
    private readonly audit: AuditService
  ) {}

  async execute(input: CreateSaleInput): Promise<SaleRecord> {
    const ctx = getTenantContext();
    const hasUnlimitedDiscount = ctx.permissions.has("discount.authorize");
    const maxDiscountPercent = hasUnlimitedDiscount
      ? 100
      : (await this.discountLimitRepo.getMaxDiscountPercent(ctx.userId)) ?? 0;

    let subtotal = 0;
    let discountTotal = 0;
    let taxTotal = 0;
    let total = 0;
    let needsAuthorization = false;

    const computedItems: ComputedSaleItem[] = [];
    for (const item of input.items) {
      const product = await this.productRepo.findByIdOrThrow(item.productId);
      const props = product.toProps;

      const lineSubtotal = round2(props.currentPrice * item.quantity);
      const discountAmount = round2(lineSubtotal - applyDiscount(lineSubtotal, item.discountPercent));
      const taxableBase = lineSubtotal - discountAmount;
      const taxAmount = calculateTax(taxableBase, props.taxRate);
      const lineTotal = round2(taxableBase + taxAmount);

      const requiresAuth = item.discountPercent > maxDiscountPercent;
      if (requiresAuth) needsAuthorization = true;

      subtotal = round2(subtotal + lineSubtotal);
      discountTotal = round2(discountTotal + discountAmount);
      taxTotal = round2(taxTotal + taxAmount);
      total = round2(total + lineTotal);

      computedItems.push({
        productId: item.productId,
        quantity: item.quantity,
        unitPrice: props.currentPrice,
        discountPercent: item.discountPercent,
        discountAmount,
        taxPercent: props.taxRate,
        taxAmount,
        total: lineTotal,
        requiresDiscountAuthorization: requiresAuth,
      });
    }

    const paymentsTotal = round2(input.payments.reduce((sum, p) => sum + p.amount, 0));
    if (!needsAuthorization && paymentsTotal < total) {
      throw new ValidationError(`Los pagos (${paymentsTotal}) no cubren el total de la venta (${total})`);
    }

    const paymentStatus = needsAuthorization
      ? "PENDING"
      : paymentsTotal >= total
        ? "PAID"
        : paymentsTotal > 0
          ? "PARTIAL"
          : "CREDIT";

    const sale = await this.saleRepo.create({
      branchId: input.branchId,
      cashSessionId: input.cashSessionId,
      customerId: input.customerId,
      sellerUserId: ctx.userId,
      status: needsAuthorization ? "PENDING_AUTHORIZATION" : "COMPLETED",
      subtotal,
      discountTotal,
      taxTotal,
      total,
      paymentStatus,
      items: computedItems,
      payments: input.payments,
    });

    await this.audit.record({
      action: "SALE_COMPLETED",
      entityType: "Sale",
      entityId: sale.id,
      description: needsAuthorization
        ? `Venta #${sale.number} pendiente de autorizacion de descuento`
        : `Venta #${sale.number} completada por ${total}`,
      metadata: { total, needsAuthorization },
    });

    if (sale.status === "COMPLETED") {
      await this.postSaleJournalEntry.execute({
        saleId: sale.id,
        branchId: sale.branchId,
        date: sale.createdAt,
        number: sale.number,
        subtotal: sale.subtotal,
        discountTotal: sale.discountTotal,
        taxTotal: sale.taxTotal,
        total: sale.total,
        payments: sale.payments,
      });
    }

    return sale;
  }
}
