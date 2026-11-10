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

/** Clave estable para un beneficiario de gasto (texto libre): mismo nombre = mismo tercero. */
function payeeId(name: string): string {
  return `payee:${name.trim().toLowerCase()}`;
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
    const manualInvoiceIds = uniqueIds(lines, "ManualInvoice");
    const expenseIds = uniqueIds(lines, "Expense");
    const commissionIds = uniqueIds(lines, "Commission");

    const [sales, returns, purchases, supplierPayments, receivablePayments, manualInvoices, expenses, commissions] = await Promise.all([
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
      manualInvoiceIds.length
        ? prisma.manualInvoice.findMany({ where: { id: { in: manualInvoiceIds }, companyId }, select: { id: true, customerId: true } })
        : [],
      expenseIds.length
        ? prisma.expense.findMany({ where: { id: { in: expenseIds }, companyId }, select: { id: true, payeeName: true } })
        : [],
      commissionIds.length
        ? prisma.commissionSettlement.findMany({ where: { id: { in: commissionIds }, companyId }, select: { id: true, sellerUserId: true } })
        : [],
    ]);

    const customerIds = new Set<string>();
    const supplierIds = new Set<string>();
    const userIds = new Set<string>();
    for (const s of sales) if (s.customerId) customerIds.add(s.customerId);
    for (const r of returns) if (r.customerId) customerIds.add(r.customerId);
    for (const m of manualInvoices) if (m.customerId) customerIds.add(m.customerId);
    for (const p of purchases) supplierIds.add(p.supplierId);
    for (const sp of supplierPayments) if (sp.accountPayable?.supplierId) supplierIds.add(sp.accountPayable.supplierId);
    for (const rp of receivablePayments) if (rp.accountReceivable?.customerId) customerIds.add(rp.accountReceivable.customerId);
    for (const c of commissions) userIds.add(c.sellerUserId);

    const [customers, suppliers, users] = await Promise.all([
      customerIds.size
        ? prisma.customer.findMany({ where: { id: { in: [...customerIds] } }, select: { id: true, name: true, documentNumber: true } })
        : [],
      supplierIds.size
        ? prisma.supplier.findMany({ where: { id: { in: [...supplierIds] } }, select: { id: true, name: true, nit: true } })
        : [],
      userIds.size ? prisma.user.findMany({ where: { id: { in: [...userIds] }, companyId }, select: { id: true, fullName: true } }) : [],
    ]);
    const customerById = new Map<string, ThirdPartyRef>(customers.map((c) => [c.id, { id: c.id, name: c.name, document: c.documentNumber }]));
    const supplierById = new Map<string, ThirdPartyRef>(suppliers.map((s) => [s.id, { id: s.id, name: s.name, document: s.nit }]));
    const userById = new Map<string, ThirdPartyRef>(users.map((u) => [u.id, { id: u.id, name: u.fullName, document: null }]));

    const put = (sourceType: string, sourceId: string, ref: ThirdPartyRef | undefined) => {
      if (ref) result.set(sourceKey(sourceType, sourceId), ref);
    };

    for (const s of sales) put("Sale", s.id, s.customerId ? customerById.get(s.customerId) : undefined);
    for (const r of returns) put("Return", r.id, r.customerId ? customerById.get(r.customerId) : undefined);
    for (const m of manualInvoices) put("ManualInvoice", m.id, m.customerId ? customerById.get(m.customerId) : undefined);
    for (const p of purchases) put("Purchase", p.id, supplierById.get(p.supplierId));
    for (const sp of supplierPayments) {
      const supplierId = sp.accountPayable?.supplierId;
      put("SupplierPayment", sp.id, supplierId ? supplierById.get(supplierId) : undefined);
    }
    for (const rp of receivablePayments) {
      const customerId = rp.accountReceivable?.customerId;
      put("AccountReceivablePayment", rp.id, customerId ? customerById.get(customerId) : undefined);
    }
    for (const c of commissions) put("Commission", c.id, userById.get(c.sellerUserId));
    for (const e of expenses) {
      if (e.payeeName.trim()) put("Expense", e.id, { id: payeeId(e.payeeName), name: e.payeeName.trim(), document: null });
    }

    return result;
  }
}
