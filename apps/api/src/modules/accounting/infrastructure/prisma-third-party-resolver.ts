import { prisma } from "../../../shared/prisma/prisma-client";
import { getTenantContext } from "../../../shared/context/request-context";
import type { IThirdPartyResolver, ThirdPartyRef } from "../domain/third-party-resolver";

function sourceKey(sourceType: string, sourceId: string): string {
  return `${sourceType}:${sourceId}`;
}

function uniqueIds(
  lines: { sourceType: string | null; sourceId: string | null }[],
  sourceType: string
): string[] {
  return [...new Set(lines.filter((l) => l.sourceType === sourceType && l.sourceId).map((l) => l.sourceId as string))];
}

export class PrismaThirdPartyResolver implements IThirdPartyResolver {
  async resolveForLines(lines: { sourceType: string | null; sourceId: string | null }[]): Promise<Map<string, ThirdPartyRef>> {
    const companyId = getTenantContext().companyId;
    const result = new Map<string, ThirdPartyRef>();

    const saleIds = uniqueIds(lines, "Sale");
    const returnIds = uniqueIds(lines, "Return");
    const purchaseIds = uniqueIds(lines, "Purchase");
    const supplierPaymentIds = uniqueIds(lines, "SupplierPayment");
    const receivablePaymentIds = uniqueIds(lines, "AccountReceivablePayment");

    const [sales, returns, purchases, supplierPayments, receivablePayments] = await Promise.all([
      saleIds.length
        ? prisma.sale.findMany({ where: { id: { in: saleIds }, companyId }, select: { id: true, customerId: true } })
        : [],
      returnIds.length
        ? prisma.return.findMany({ where: { id: { in: returnIds }, companyId }, select: { id: true, customerId: true } })
        : [],
      purchaseIds.length
        ? prisma.purchase.findMany({ where: { id: { in: purchaseIds }, companyId }, select: { id: true, supplierId: true } })
        : [],
      // SupplierPayment/AccountReceivablePayment no tienen companyId propio -- el aislamiento de
      // tenant viene de filtrar por el companyId de su padre (mismo criterio que
      // tenant.extension.ts documenta para estos dos modelos).
      supplierPaymentIds.length
        ? prisma.supplierPayment.findMany({
            where: { id: { in: supplierPaymentIds }, accountPayable: { companyId } },
            select: { id: true, accountPayable: { select: { supplierId: true } } },
          })
        : [],
      receivablePaymentIds.length
        ? prisma.accountReceivablePayment.findMany({
            where: { id: { in: receivablePaymentIds }, accountReceivable: { companyId } },
            select: { id: true, accountReceivable: { select: { customerId: true } } },
          })
        : [],
    ]);

    const customerIds = new Set<string>();
    const supplierIds = new Set<string>();
    for (const s of sales) if (s.customerId) customerIds.add(s.customerId);
    for (const r of returns) if (r.customerId) customerIds.add(r.customerId);
    for (const p of purchases) supplierIds.add(p.supplierId);
    for (const sp of supplierPayments) if (sp.accountPayable?.supplierId) supplierIds.add(sp.accountPayable.supplierId);
    for (const rp of receivablePayments) if (rp.accountReceivable?.customerId) customerIds.add(rp.accountReceivable.customerId);

    const [customers, suppliers] = await Promise.all([
      customerIds.size ? prisma.customer.findMany({ where: { id: { in: [...customerIds] } }, select: { id: true, name: true } }) : [],
      supplierIds.size ? prisma.supplier.findMany({ where: { id: { in: [...supplierIds] } }, select: { id: true, name: true } }) : [],
    ]);
    const customerNameById = new Map(customers.map((c) => [c.id, c.name]));
    const supplierNameById = new Map(suppliers.map((s) => [s.id, s.name]));

    for (const s of sales) {
      if (s.customerId && customerNameById.has(s.customerId)) {
        result.set(sourceKey("Sale", s.id), { id: s.customerId, name: customerNameById.get(s.customerId)! });
      }
    }
    for (const r of returns) {
      if (r.customerId && customerNameById.has(r.customerId)) {
        result.set(sourceKey("Return", r.id), { id: r.customerId, name: customerNameById.get(r.customerId)! });
      }
    }
    for (const p of purchases) {
      if (supplierNameById.has(p.supplierId)) {
        result.set(sourceKey("Purchase", p.id), { id: p.supplierId, name: supplierNameById.get(p.supplierId)! });
      }
    }
    for (const sp of supplierPayments) {
      const supplierId = sp.accountPayable?.supplierId;
      if (supplierId && supplierNameById.has(supplierId)) {
        result.set(sourceKey("SupplierPayment", sp.id), { id: supplierId, name: supplierNameById.get(supplierId)! });
      }
    }
    for (const rp of receivablePayments) {
      const customerId = rp.accountReceivable?.customerId;
      if (customerId && customerNameById.has(customerId)) {
        result.set(sourceKey("AccountReceivablePayment", rp.id), { id: customerId, name: customerNameById.get(customerId)! });
      }
    }

    return result;
  }
}
