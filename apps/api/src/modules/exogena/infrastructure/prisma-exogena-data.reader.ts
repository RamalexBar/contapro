import { basePrisma } from "@erp/database";
import { prisma } from "../../../shared/prisma/prisma-client";
import { getTenantContext } from "../../../shared/context/request-context";
import type { ExogenaPayrollData, ExogenaPurchase, ExogenaYearData, IExogenaDataReader } from "../domain/exogena-data.reader";

const n = (value: unknown) => Number(value ?? 0);
const round2 = (value: number) => Math.round(value * 100) / 100;

/** Ventas que cuentan como ingreso (las anuladas no; las devueltas si, y su devolucion resta aparte). */
const INCOME_SALE_STATUSES = ["COMPLETED", "RETURNED_PARTIAL", "RETURNED_FULL"] as const;

type SaleRow = { id: string; customerId: string | null; subtotal: unknown; discountTotal: unknown; taxTotal: unknown; total: unknown };

/** Lee de la base todo lo que necesitan los formatos de exogena de un año (solo lectura). */
export class PrismaExogenaDataReader implements IExogenaDataReader {
  async yearData(year: number): Promise<ExogenaYearData> {
    const from = new Date(year, 0, 1);
    const to = new Date(year + 1, 0, 1);
    const inYear = { gte: from, lt: to };

    const [purchases, sales, manualInvoices, shiftCloses, returns, creditNotes, expenses] = await Promise.all([
      prisma.purchase.findMany({
        where: { status: "REGISTERED", createdAt: inYear },
        include: { withholdings: { include: { withholdingConcept: { select: { code: true, type: true } } } } },
      }),
      prisma.sale.findMany({
        where: { status: { in: [...INCOME_SALE_STATUSES] }, createdAt: inYear },
        select: { id: true, customerId: true, subtotal: true, discountTotal: true, taxTotal: true, total: true },
      }),
      prisma.manualInvoice.findMany({ where: { issueDate: inYear }, include: { items: true } }),
      prisma.externalShiftClose.findMany({ where: { status: "POSTED", createdAt: inYear }, select: { taxSummary: true } }),
      prisma.return.findMany({ where: { createdAt: inYear }, include: { items: true } }),
      prisma.creditNote.findMany({ where: { returnId: null, createdAt: inYear }, select: { saleId: true, customerId: true, amount: true } }),
      prisma.expense.findMany({ where: { status: "REGISTERED", date: inYear }, include: { expenseCategory: { select: { code: true } } } }),
    ]);

    // Tipo de compra segun la cuenta que debito su comprobante: 1435 inventario, 15xx activo fijo, resto gasto.
    const entryIds = purchases.map((p) => p.journalEntryId).filter((id): id is string => Boolean(id));
    const lines = entryIds.length
      ? await prisma.journalEntryLine.findMany({ where: { journalEntryId: { in: entryIds }, debit: { gt: 0 } }, select: { journalEntryId: true, accountId: true } })
      : [];
    const accounts = lines.length
      ? await prisma.chartOfAccounts.findMany({ where: { id: { in: [...new Set(lines.map((l) => l.accountId))] } }, select: { id: true, code: true } })
      : [];
    const codeOf = new Map(accounts.map((a) => [a.id, a.code]));
    const debitCodes = new Map<string, string[]>();
    for (const l of lines) debitCodes.set(l.journalEntryId, [...(debitCodes.get(l.journalEntryId) ?? []), codeOf.get(l.accountId) ?? ""]);
    const kindOf = (journalEntryId: string | null): ExogenaPurchase["kind"] => {
      const codes = journalEntryId ? debitCodes.get(journalEntryId) ?? [] : [];
      if (codes.some((c) => c.startsWith("14"))) return "INVENTORY";
      if (codes.some((c) => c.startsWith("15"))) return "FIXED_ASSET";
      return journalEntryId ? "EXPENSE" : "INVENTORY";
    };

    // IVA de cada devolucion: la tarifa del renglon vendido; las notas libres, en proporcion al IVA de la venta.
    const saleItemIds = returns.flatMap((r) => r.items.map((i) => i.saleItemId));
    const saleItems = saleItemIds.length
      ? await prisma.saleItem.findMany({ where: { id: { in: saleItemIds } }, select: { id: true, taxPercent: true } })
      : [];
    const taxPercentOf = new Map(saleItems.map((i) => [i.id, n(i.taxPercent)]));
    const saleById = new Map<string, SaleRow>(sales.map((s) => [s.id, s]));
    const extraSaleIds = [...returns.map((r) => r.saleId), ...creditNotes.map((c) => c.saleId).filter((id): id is string => Boolean(id))].filter((id) => !saleById.has(id));
    if (extraSaleIds.length) {
      const extra = await prisma.sale.findMany({ where: { id: { in: extraSaleIds } }, select: { id: true, customerId: true, subtotal: true, discountTotal: true, taxTotal: true, total: true } });
      for (const s of extra) saleById.set(s.id, s);
    }

    const supplierIds = [...new Set(purchases.map((p) => p.supplierId))];
    const customerIds = [
      ...new Set(
        [...sales.map((s) => s.customerId), ...manualInvoices.map((m) => m.customerId), ...returns.map((r) => r.customerId), ...creditNotes.map((c) => c.customerId)].filter(
          (id): id is string => Boolean(id)
        )
      ),
    ];
    const [suppliers, customers] = await Promise.all([
      supplierIds.length ? prisma.supplier.findMany({ where: { id: { in: supplierIds } } }) : [],
      customerIds.length ? prisma.customer.findMany({ where: { id: { in: customerIds } } }) : [],
    ]);

    return {
      purchases: purchases.map((p) => ({
        supplierId: p.supplierId,
        subtotal: n(p.subtotal),
        taxTotal: n(p.taxTotal),
        kind: kindOf(p.journalEntryId),
        withholdings: p.withholdings.map((w) => ({ type: w.withholdingConcept.type as "RETEFUENTE" | "RETEICA" | "RETEIVA", conceptCode: w.withholdingConcept.code, amount: n(w.amount) })),
      })),
      expenses: expenses.map((e) => ({
        payeeName: e.payeeName,
        payeeDocumentType: e.payeeDocumentType,
        payeeDocumentNumber: e.payeeDocumentNumber,
        categoryCode: e.expenseCategory.code,
        subtotal: n(e.subtotal),
        taxTotal: n(e.taxTotal),
      })),
      sales: sales.map((s) => ({ customerId: s.customerId, subtotal: n(s.subtotal), discountTotal: n(s.discountTotal), taxTotal: n(s.taxTotal) })),
      manualInvoices: manualInvoices.map((m) => ({
        customerId: m.customerId,
        external: m.createdByUserId.startsWith("api:"),
        subtotal: n(m.subtotal),
        ivaTotal: round2(m.items.filter((i) => i.taxType !== "INC").reduce((s, i) => s + n(i.taxAmount), 0)),
        incTotal: round2(m.items.filter((i) => i.taxType === "INC").reduce((s, i) => s + n(i.taxAmount), 0)),
      })),
      shiftCloses: shiftCloses.map((c) => {
        const summary = (c.taxSummary ?? { sales: [], returns: [] }) as {
          sales?: { taxType: string; taxableBase: number; taxAmount: number }[];
          returns?: { taxType: string; taxableAmount: number; taxAmount: number }[];
        };
        const salesRows = summary.sales ?? [];
        const returnRows = summary.returns ?? [];
        return {
          base: round2(salesRows.reduce((s, r) => s + n(r.taxableBase), 0)),
          iva: round2(salesRows.filter((r) => r.taxType !== "INC").reduce((s, r) => s + n(r.taxAmount), 0)),
          inc: round2(salesRows.filter((r) => r.taxType === "INC").reduce((s, r) => s + n(r.taxAmount), 0)),
          returnsBase: round2(returnRows.reduce((s, r) => s + n(r.taxableAmount), 0)),
          returnsIva: round2(returnRows.filter((r) => r.taxType !== "INC").reduce((s, r) => s + n(r.taxAmount), 0)),
        };
      }),
      returns: returns.map((r) => {
        let tax = 0;
        for (const i of r.items) {
          const rate = taxPercentOf.get(i.saleItemId) ?? 0;
          tax += (n(i.total) * rate) / (100 + rate);
        }
        return { customerId: r.customerId ?? saleById.get(r.saleId)?.customerId ?? null, base: round2(n(r.total) - tax), tax: round2(tax) };
      }),
      creditNotes: creditNotes.map((c) => {
        const sale = c.saleId ? saleById.get(c.saleId) : undefined;
        const taxShare = sale && n(sale.total) > 0 ? n(sale.taxTotal) / n(sale.total) : 0;
        const tax = round2(n(c.amount) * taxShare);
        return { customerId: c.customerId, base: round2(n(c.amount) - tax), tax };
      }),
      suppliers: suppliers.map((s) => ({ id: s.id, documentType: s.documentType, documentNumber: s.nit, name: s.name, municipalityCode: s.municipalityCode })),
      customers: customers.map((c) => ({ id: c.id, documentType: c.documentType, documentNumber: c.documentNumber, name: c.name, municipalityCode: c.municipalityCode })),
    };
  }

  async payrollData(year: number): Promise<ExogenaPayrollData> {
    const from = new Date(year, 0, 1);
    const to = new Date(year + 1, 0, 1);
    const companyId = getTenantContext().companyId;
    // Pagado en el año: nominas aprobadas o pagadas cuyo periodo termina en el año.
    const [details, settlements, company] = await Promise.all([
      prisma.payrollDetail.findMany({
        where: { payroll: { status: { in: ["APPROVED", "PAID"] }, endDate: { gte: from, lt: to } } },
        select: { employeeId: true, items: { select: { conceptCode: true, amount: true } } },
      }),
      prisma.benefitSettlement.findMany({ where: { createdAt: { gte: from, lt: to } } }),
      basePrisma.company.findFirst({ where: { id: companyId }, select: { municipalityCode: true } }),
    ]);
    const employeeIds = [...new Set([...details.map((d) => d.employeeId), ...settlements.map((s) => s.employeeId)])];
    const employees = employeeIds.length ? await prisma.employee.findMany({ where: { id: { in: employeeIds } } }) : [];

    return {
      employees: employees.map((e) => ({
        id: e.id,
        documentType: e.documentType,
        documentNumber: e.documentNumber,
        firstName: e.firstName,
        middleName: e.middleName,
        lastName: e.lastName,
        secondLastName: e.secondLastName,
        address: e.address,
      })),
      workplaceMunicipalityCode: company?.municipalityCode ?? null,
      items: details.flatMap((d) => d.items.map((i) => ({ employeeId: d.employeeId, conceptCode: i.conceptCode, amount: n(i.amount) }))),
      settlements: settlements.map((s) => {
        const detail = s.detail as { lines?: Array<{ concept: string; amount: number }> };
        return {
          employeeId: s.employeeId,
          type: s.type,
          lines: (detail.lines ?? []).map((l) => ({ concept: l.concept, amount: n(l.amount) })),
          withholding: n(s.withholding),
          toSeveranceFund: n(s.toSeveranceFund),
        };
      }),
    };
  }
}
