import { prisma } from "../../../shared/prisma/prisma-client";
import { getTenantContext } from "../../../shared/context/request-context";
import type { ShiftCloseTaxSummary } from "../../public-api/domain/external-shift-close.repository";
import type { IVatActivityReader, TaxableActivity, TaxRateRow } from "../domain/vat-activity.reader";

const SOLD_STATUSES = ["COMPLETED", "RETURNED_PARTIAL", "RETURNED_FULL"] as const;
const KNOWN_RATES = [19, 16, 8, 5, 0];

/** Tarifa de una devolucion de cierre de turno (Cajapro no la manda, solo base e impuesto). */
function inferRate(base: number, tax: number): number {
  if (base <= 0 || tax <= 0) return 0;
  const raw = (tax / base) * 100;
  return KNOWN_RATES.reduce((best, r) => (Math.abs(r - raw) < Math.abs(best - raw) ? r : best), KNOWN_RATES[0]);
}

/** Las ventas del punto de venta de Contapro no distinguen exento de excluido: 0 % sale como "IVA 0 %". */
export class PrismaVatActivityReader implements IVatActivityReader {
  async getTaxableActivity(from: Date, to: Date, branchId?: string): Promise<TaxableActivity> {
    const companyId = getTenantContext().companyId;
    const sales: TaxRateRow[] = [];
    const returns: TaxRateRow[] = [];

    const saleItems = await prisma.saleItem.findMany({
      where: { sale: { companyId, branchId, status: { in: [...SOLD_STATUSES] }, createdAt: { gte: from, lte: to } } },
      select: { id: true, taxPercent: true, taxAmount: true, total: true },
    });
    for (const i of saleItems) {
      const tax = Number(i.taxAmount);
      sales.push({ taxType: "IVA", taxRate: Number(i.taxPercent), taxableBase: Number(i.total) - tax, taxAmount: tax });
    }

    const returnItems = await prisma.returnItem.findMany({
      where: { return: { companyId, branchId, status: { not: "CANCELLED" }, createdAt: { gte: from, lte: to } } },
      select: { saleItemId: true, quantity: true, unitPrice: true, total: true },
    });
    if (returnItems.length) {
      const rates = new Map(
        (
          await prisma.saleItem.findMany({
            where: { id: { in: returnItems.map((r) => r.saleItemId) }, sale: { companyId } },
            select: { id: true, taxPercent: true },
          })
        ).map((s) => [s.id, Number(s.taxPercent)])
      );
      for (const r of returnItems) {
        const base = Number(r.unitPrice) * Number(r.quantity);
        returns.push({ taxType: "IVA", taxRate: rates.get(r.saleItemId) ?? 0, taxableBase: base, taxAmount: Number(r.total) - base });
      }
    }

    // Cierres de turno de un POS externo: la fecha que cuenta es la del turno (la del comprobante),
    // que puede llegar dias despues -- se trae un margen por createdAt y se filtra por la del resumen.
    const margin = 45 * 86_400_000;
    const closes = await prisma.externalShiftClose.findMany({
      where: { companyId, branchId, status: "POSTED", createdAt: { gte: new Date(from.getTime() - margin), lte: new Date(to.getTime() + margin) } },
      select: { taxSummary: true, createdAt: true },
    });
    let shiftClosesWithoutDetail = 0;
    for (const c of closes) {
      const summary = c.taxSummary as ShiftCloseTaxSummary | null;
      if (!summary) {
        if (c.createdAt >= from && c.createdAt <= to) shiftClosesWithoutDetail++;
        continue;
      }
      const date = new Date(summary.date);
      if (date < from || date > to) continue;
      for (const s of summary.sales) sales.push({ taxType: s.taxType, taxRate: s.taxRate, taxableBase: s.taxableBase, taxAmount: s.taxAmount });
      for (const r of summary.returns) {
        returns.push({ taxType: r.taxType, taxRate: inferRate(r.taxableAmount, r.taxAmount), taxableBase: r.taxableAmount, taxAmount: r.taxAmount });
      }
    }

    return { sales, returns, shiftClosesWithoutDetail };
  }
}
