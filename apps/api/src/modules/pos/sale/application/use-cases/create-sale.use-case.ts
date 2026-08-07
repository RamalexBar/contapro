import type { CreateSaleInput } from "@erp/shared-types";
import { applyDiscount, calculateTax, round2 } from "@erp/shared-utils";
import { getTenantContext } from "../../../../../shared/context/request-context";
import { ValidationError } from "../../../../../shared/errors/app-error";
import type { AuditService } from "../../../../audit/application/audit.service";
import type { PostSaleJournalEntryUseCase } from "../../../../accounting/application/use-cases/post-sale-journal-entry.use-case";
import type { GenerateElectronicInvoiceUseCase } from "../../../../electronic-invoicing/application/use-cases/generate-electronic-invoice.use-case";
import type { WebhookDispatcherService } from "../../../../webhooks/application/webhook-dispatcher.service";
import type { SendInvoiceWhatsAppUseCase } from "../../../../electronic-invoicing/application/use-cases/send-invoice-whatsapp.use-case";
import type { IProductRepository } from "../../../../inventory/product/domain/product.repository";
import type { IWithholdingConceptRepository } from "../../../../accounting/domain/withholding-concept.repository";
import type { ICustomerRepository } from "../../../../customers/domain/customer.repository";
import type { IPriceListRepository } from "../../../../inventory/price-list/domain/price-list.repository";
import { resolveEffectivePriceListId } from "../../../../inventory/price-list/application/resolve-effective-price-list-id";
import { resolveEffectivePrice } from "../../../../inventory/price-list/application/resolve-effective-price";
import type { ComputedSaleItem, ComputedSaleWithholding, ISaleRepository, SaleRecord } from "../../domain/sale.repository";
import type { IDiscountLimitRepository } from "../../domain/discount-limit.repository";
import { sumWithholdingsByType } from "../../../../accounting/application/sum-withholdings-by-type";
import { resolveReceivableInput } from "../resolve-receivable-input";

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
    private readonly withholdingConceptRepo: IWithholdingConceptRepository,
    private readonly customerRepo: ICustomerRepository,
    private readonly priceListRepo: IPriceListRepository,
    private readonly postSaleJournalEntry: PostSaleJournalEntryUseCase,
    private readonly generateElectronicInvoice: GenerateElectronicInvoiceUseCase,
    private readonly webhookDispatcher: WebhookDispatcherService,
    private readonly sendInvoiceWhatsApp: SendInvoiceWhatsAppUseCase,
    private readonly audit: AuditService
  ) {}

  async execute(input: CreateSaleInput): Promise<SaleRecord> {
    const ctx = getTenantContext();
    const hasUnlimitedDiscount = ctx.permissions.has("discount.authorize");
    const maxDiscountPercent = hasUnlimitedDiscount
      ? 100
      : (await this.discountLimitRepo.getMaxDiscountPercent(ctx.userId)) ?? 0;

    // Item 35 de docs/ALCANCE.md (listas de precios): la lista explicita del request gana sobre
    // la asignada al cliente; sin ninguna de las dos, precio base (null).
    const effectivePriceListId = await resolveEffectivePriceListId(
      this.customerRepo,
      this.priceListRepo,
      input.priceListId,
      input.customerId
    );

    let subtotal = 0;
    let discountTotal = 0;
    let taxTotal = 0;
    let total = 0;
    let needsAuthorization = false;

    const computedItems: ComputedSaleItem[] = [];
    const productNames: string[] = [];
    for (const item of input.items) {
      const product = await this.productRepo.findByIdOrThrow(item.productId);
      const props = product.toProps;
      productNames.push(props.name);

      const unitPrice = await resolveEffectivePrice(this.priceListRepo, effectivePriceListId, item.productId, props.currentPrice);
      const lineSubtotal = round2(unitPrice * item.quantity);
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
        unitPrice,
        discountPercent: item.discountPercent,
        discountAmount,
        taxPercent: props.taxRate,
        taxAmount,
        total: lineTotal,
        requiresDiscountAuthorization: requiresAuth,
      });
    }

    // Retenciones que el cliente practica sobre esta venta (RteFuente/ReteICA/ReteIVA, ver
    // WithholdingConcept): son informativas para la DIAN, no reducen `total` (el bruto legal de
    // la factura) pero si el efectivo que el cliente realmente entrega -- por eso se validan y
    // acumulan aqui, antes de comprobar que los pagos alcanzan, y se comparan contra `netTotal`
    // en vez de `total` de ahi en adelante.
    let retentionTotal = 0;
    const computedWithholdings: ComputedSaleWithholding[] = [];
    for (const w of input.withholdings) {
      const concept = await this.withholdingConceptRepo.findByIdOrThrow(w.withholdingConceptId);
      if (!concept.isActive) {
        throw new ValidationError(`El concepto de retencion ${concept.code} esta inactivo`);
      }
      if (w.base > subtotal) {
        throw new ValidationError(`La base de retencion (${w.base}) no puede superar el subtotal de la venta (${subtotal})`);
      }
      const amount = calculateTax(w.base, concept.ratePercent);
      retentionTotal = round2(retentionTotal + amount);
      computedWithholdings.push({
        withholdingConceptId: concept.id,
        type: concept.type,
        base: w.base,
        ratePercent: concept.ratePercent,
        amount,
      });
    }

    const netTotal = round2(total - retentionTotal);
    const paymentsTotal = round2(input.payments.reduce((sum, p) => sum + p.amount, 0));
    if (!needsAuthorization && paymentsTotal < netTotal) {
      throw new ValidationError(`Los pagos (${paymentsTotal}) no cubren el neto a cobrar de la venta (${netTotal})`);
    }

    const paymentStatus = needsAuthorization
      ? "PENDING"
      : paymentsTotal >= netTotal
        ? "PAID"
        : paymentsTotal > 0
          ? "PARTIAL"
          : "CREDIT";

    // Una venta con pago CREDIT genera una AccountReceivable (item 31, modulo `collections`) --
    // solo si la venta se completa de una vez; si necesita autorizacion de descuento, se crea
    // despues en AuthorizeDiscountUseCase (Sale no tiene columna dueDate propia, asi que el
    // request original no se puede "guardar" mientras la venta espera, ver
    // resolve-receivable-input.ts).
    const receivable = needsAuthorization ? null : resolveReceivableInput(input.payments, input.customerId, input.dueDate);

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
      retentionTotal,
      paymentStatus,
      items: computedItems,
      payments: input.payments,
      withholdings: computedWithholdings,
      receivable: receivable ?? undefined,
      currency: input.currency,
      exchangeRate: input.exchangeRate,
      priceListId: effectivePriceListId,
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
        retentionTotal: sale.retentionTotal,
        withholdingsByType: sumWithholdingsByType(sale.withholdings),
        payments: sale.payments,
        currency: sale.currency,
        exchangeRate: sale.exchangeRate,
      });

      try {
        await this.generateElectronicInvoice.execute({
          saleId: sale.id,
          branchId: sale.branchId,
          customerId: input.customerId ?? null,
          issueDate: sale.createdAt,
          subtotal: sale.subtotal,
          taxTotal: sale.taxTotal,
          total: sale.total,
          currency: sale.currency,
          items: computedItems.map((item, i) => ({
            description: productNames[i],
            quantity: item.quantity,
            unitPrice: item.unitPrice,
            taxPercent: item.taxPercent,
            taxAmount: item.taxAmount,
            total: item.total,
          })),
          withholdingTaxes: sale.withholdings.map((w) => ({
            type: w.type,
            base: w.base,
            ratePercent: w.ratePercent,
            amount: w.amount,
          })),
        });
      } catch (err) {
        // No bloquear la venta si falla la facturacion electronica local (ver README del
        // modulo): se audita el fallo y la venta queda COMPLETED sin CUFE, recuperable
        // manualmente despues (mismo criterio que la contabilizacion automatica arriba).
        await this.audit.record({
          action: "ELECTRONIC_INVOICE_GENERATION_FAILED",
          entityType: "Sale",
          entityId: sale.id,
          description: `No se pudo generar la factura electronica de la venta #${sale.number}: ${(err as Error).message}`,
          metadata: {},
        });
      }

      try {
        await this.webhookDispatcher.dispatch("sale.created", {
          id: sale.id,
          number: sale.number,
          customerId: sale.customerId,
          total: sale.total,
          currency: sale.currency,
          status: sale.status,
          createdAt: sale.createdAt,
        });
      } catch (err) {
        // Mismo criterio que la facturacion electronica arriba: un webhook que falla no debe
        // bloquear la venta (el dispatcher ya registra la entrega fallida por suscripcion; esto
        // solo cubre un fallo del dispatcher mismo, ej. el catalogo de suscripciones).
        await this.audit.record({
          action: "WEBHOOK_DISPATCH_FAILED",
          entityType: "Sale",
          entityId: sale.id,
          description: `No se pudo despachar el evento sale.created de la venta #${sale.number}: ${(err as Error).message}`,
          metadata: {},
        });
      }

      try {
        // sendInvoiceWhatsAppUseCase ya audita/registra exito y fallo internamente (nunca lanza
        // por un fallo de envio real) -- este try/catch es solo una red de seguridad ante un
        // error inesperado que se le escape (ej. de infraestructura), mismo criterio que
        // webhookDispatcher arriba.
        await this.sendInvoiceWhatsApp.execute({ saleId: sale.id, customerId: sale.customerId });
      } catch (err) {
        await this.audit.record({
          action: "WHATSAPP_RIDE_SEND_FAILED",
          entityType: "Sale",
          entityId: sale.id,
          description: `No se pudo enviar el RIDE por WhatsApp de la venta #${sale.number}: ${(err as Error).message}`,
          metadata: {},
        });
      }
    }

    return sale;
  }
}
