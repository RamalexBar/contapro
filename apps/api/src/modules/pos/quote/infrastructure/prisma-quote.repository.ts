import { prisma } from "../../../../shared/prisma/prisma-client";
import { getTenantContext } from "../../../../shared/context/request-context";
import { applyDiscount, round2 } from "@erp/shared-utils";
import { NotFoundError } from "../../../../shared/errors/app-error";
import type { IPriceListRepository } from "../../../inventory/price-list/domain/price-list.repository";
import { resolveEffectivePrice } from "../../../inventory/price-list/application/resolve-effective-price";
import type { CreateQuoteData, IQuoteRepository, QuoteDetail, QuoteRecord } from "../domain/quote.repository";

export class PrismaQuoteRepository implements IQuoteRepository {
  constructor(private readonly priceListRepo: IPriceListRepository) {}

  async create(data: CreateQuoteData): Promise<QuoteRecord> {
    const companyId = getTenantContext().companyId;

    let subtotal = 0;
    let total = 0;
    const itemsData = [];
    for (const item of data.items) {
      const product = await prisma.product.findFirst({ where: { id: item.productId } });
      const basePrice = Number(product?.currentPrice ?? 0);
      const unitPrice = await resolveEffectivePrice(this.priceListRepo, data.priceListId, item.productId, basePrice);
      const lineSubtotal = round2(unitPrice * item.quantity);
      const lineTotal = applyDiscount(lineSubtotal, item.discountPercent);
      subtotal = round2(subtotal + lineSubtotal);
      total = round2(total + lineTotal);
      itemsData.push({
        productId: item.productId,
        quantity: item.quantity,
        unitPrice,
        discountPercent: item.discountPercent,
        total: lineTotal,
      });
    }

    const quote = await prisma.quote.create({
      data: {
        companyId,
        branchId: data.branchId,
        customerId: data.customerId,
        sellerUserId: data.sellerUserId,
        validUntil: data.validUntil,
        subtotal,
        total,
        priceListId: data.priceListId,
        items: { create: itemsData },
      },
    });

    return {
      id: quote.id,
      status: quote.status,
      subtotal,
      total,
      validUntil: quote.validUntil,
      createdAt: quote.createdAt,
      priceListId: quote.priceListId,
    };
  }

  async findByIdOrThrow(id: string): Promise<QuoteDetail> {
    // Quote/QuoteItem no declaran relacion Prisma hacia Customer/Product (evita acoplar el schema
    // de pos/quote a esos otros dominios) -- se resuelven los nombres con consultas separadas, en
    // vez de "include", mismo criterio ya usado en suppliers para el PDF de orden de compra.
    const row = await prisma.quote.findFirst({ where: { id }, include: { items: true } });
    if (!row) throw new NotFoundError("Quote", id);

    const [customer, products] = await Promise.all([
      row.customerId ? prisma.customer.findFirst({ where: { id: row.customerId }, select: { name: true } }) : null,
      prisma.product.findMany({ where: { id: { in: row.items.map((i) => i.productId) } }, select: { id: true, name: true } }),
    ]);
    const productName = (productId: string) => products.find((p) => p.id === productId)?.name ?? "(producto no encontrado)";

    return {
      id: row.id,
      status: row.status,
      subtotal: Number(row.subtotal),
      total: Number(row.total),
      validUntil: row.validUntil,
      createdAt: row.createdAt,
      priceListId: row.priceListId,
      customerName: customer?.name ?? null,
      items: row.items.map((item) => ({
        productName: productName(item.productId),
        quantity: Number(item.quantity),
        unitPrice: Number(item.unitPrice),
        discountPercent: Number(item.discountPercent),
        total: Number(item.total),
      })),
    };
  }

  async list(): Promise<QuoteRecord[]> {
    const rows = await prisma.quote.findMany({ orderBy: { createdAt: "desc" }, take: 50 });
    return rows.map((row) => ({
      id: row.id,
      status: row.status,
      subtotal: Number(row.subtotal),
      total: Number(row.total),
      validUntil: row.validUntil,
      createdAt: row.createdAt,
      priceListId: row.priceListId,
    }));
  }
}
