import { prisma } from "../../../shared/prisma/prisma-client";
import type { IWithholdingReportReader, PracticedWithholding } from "../domain/withholding-report.reader";

const n = (value: unknown) => Number(value ?? 0);

/** Conceptos de nomina que forman la base de la retencion por rentas de trabajo. */
const LABOR_INCOME_CODES = [
  "SALARY",
  "OVERTIME_DAY",
  "OVERTIME_NIGHT",
  "NIGHT_SURCHARGE",
  "SUNDAY_SURCHARGE",
  "TRANSPORT_ALLOWANCE",
  "VACATION_PAY",
];

export class PrismaWithholdingReportReader implements IWithholdingReportReader {
  async listForMonth(year: number, month: number): Promise<PracticedWithholding[]> {
    const from = new Date(year, month - 1, 1);
    const to = new Date(year, month, 1);

    const [purchaseWithholdings, payrollDetails, settlements] = await Promise.all([
      prisma.purchaseWithholding.findMany({
        where: { purchase: { status: "REGISTERED", createdAt: { gte: from, lt: to } } },
        include: { withholdingConcept: { select: { code: true, name: true, type: true } } },
      }),
      // Nomina: la retencion se practica al pagar; se toma la de las nominas aprobadas cuyo periodo termina en el mes.
      prisma.payrollDetail.findMany({
        where: { payroll: { status: { in: ["APPROVED", "PAID"] }, endDate: { gte: from, lt: to } } },
        select: { items: { select: { conceptCode: true, amount: true } } },
      }),
      prisma.benefitSettlement.findMany({ where: { createdAt: { gte: from, lt: to } }, select: { grossTotal: true, withholding: true } }),
    ]);

    const rows: PracticedWithholding[] = purchaseWithholdings.map((w) => ({
      source: "PURCHASE",
      type: w.withholdingConcept.type as PracticedWithholding["type"],
      conceptCode: w.withholdingConcept.code,
      conceptName: w.withholdingConcept.name,
      base: n(w.base),
      amount: n(w.amount),
    }));
    for (const d of payrollDetails) {
      const amount = d.items.filter((i) => i.conceptCode === "WITHHOLDING_TAX").reduce((s, i) => s + n(i.amount), 0);
      const base = d.items.filter((i) => LABOR_INCOME_CODES.includes(i.conceptCode)).reduce((s, i) => s + n(i.amount), 0);
      rows.push({ source: "PAYROLL", type: "RETEFUENTE", conceptCode: null, conceptName: null, base, amount });
    }
    for (const s of settlements) {
      rows.push({ source: "BENEFIT_SETTLEMENT", type: "RETEFUENTE", conceptCode: null, conceptName: null, base: n(s.grossTotal), amount: n(s.withholding) });
    }
    return rows;
  }
}
