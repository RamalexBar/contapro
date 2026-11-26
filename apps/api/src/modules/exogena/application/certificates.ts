import { round2 } from "@erp/shared-utils";
import type { ExogenaPayrollData, ExogenaThirdParty, ExogenaYearData } from "../domain/exogena-data.reader";
import { buildFormat2276, type Format2276Row } from "./exogena-formats";

export type WithholdingType = "RETEFUENTE" | "RETEIVA" | "RETEICA";

export interface WithholdingCertificateLine {
  type: WithholdingType;
  conceptCode: string;
  conceptName: string;
  /** Base sobre la que se practico (suma del año). */
  base: number;
  /** Tarifa, si todas las retenciones del concepto se practicaron a la misma; si no, null. */
  ratePercent: number | null;
  amount: number;
}

export interface WithholdingCertificate {
  year: number;
  supplier: ExogenaThirdParty;
  lines: WithholdingCertificateLine[];
  totals: Record<WithholdingType, number> & { total: number };
}

const TYPE_ORDER: WithholdingType[] = ["RETEFUENTE", "RETEIVA", "RETEICA"];

/**
 * Certificado de retenciones por proveedor (art. 381 E.T. para la retencion en la fuente; la de IVA y
 * la de ICA se certifican con los mismos datos). Una linea por tipo y concepto con la base, la tarifa y
 * lo retenido en el año. Solo salen los proveedores a los que se les retuvo algo.
 */
export function buildWithholdingCertificates(
  data: Pick<ExogenaYearData, "purchases" | "suppliers">,
  year: number
): WithholdingCertificate[] {
  const suppliers = new Map(data.suppliers.map((s) => [s.id, s]));
  const bySupplier = new Map<string, Map<string, WithholdingCertificateLine>>();

  for (const p of data.purchases) {
    for (const w of p.withholdings) {
      if (w.amount <= 0) continue;
      const lines = bySupplier.get(p.supplierId) ?? new Map<string, WithholdingCertificateLine>();
      bySupplier.set(p.supplierId, lines);
      const key = `${w.type}|${w.conceptCode}`;
      const rate = w.ratePercent ?? null;
      const line = lines.get(key);
      if (!line) {
        lines.set(key, {
          type: w.type,
          conceptCode: w.conceptCode,
          conceptName: w.conceptName ?? w.conceptCode,
          base: round2(w.base ?? 0),
          ratePercent: rate,
          amount: round2(w.amount),
        });
      } else {
        line.base = round2(line.base + (w.base ?? 0));
        line.amount = round2(line.amount + w.amount);
        if (line.ratePercent !== rate) line.ratePercent = null;
      }
    }
  }

  const certificates: WithholdingCertificate[] = [];
  for (const [supplierId, linesMap] of bySupplier) {
    const supplier = suppliers.get(supplierId) ?? { id: supplierId, documentType: "NIT", documentNumber: "", name: "(proveedor no encontrado)", municipalityCode: null };
    const lines = [...linesMap.values()].sort(
      (a, b) => TYPE_ORDER.indexOf(a.type) - TYPE_ORDER.indexOf(b.type) || a.conceptName.localeCompare(b.conceptName)
    );
    const totals = { RETEFUENTE: 0, RETEIVA: 0, RETEICA: 0, total: 0 };
    for (const l of lines) {
      totals[l.type] = round2(totals[l.type] + l.amount);
      totals.total = round2(totals.total + l.amount);
    }
    certificates.push({ year, supplier, lines, totals });
  }
  return certificates.sort((a, b) => a.supplier.name.localeCompare(b.supplier.name));
}

export interface IncomeCertificate extends Format2276Row {
  year: number;
  /** Periodo certificado: el año, recortado a la fecha de ingreso y de retiro del empleado. */
  periodFrom: Date;
  periodTo: Date;
  totalIngresosBrutos: number;
}

/**
 * Certificado de ingresos y retenciones por rentas de trabajo (formulario 220, art. 378 E.T.), uno por
 * empleado. Usa la misma clasificacion de conceptos que el formato 2276 de la exogena, asi los dos
 * documentos siempre cuadran entre si.
 */
export function buildIncomeCertificates(data: ExogenaPayrollData, year: number): IncomeCertificate[] {
  const employees = new Map(data.employees.map((e) => [e.id, e]));
  const yearStart = new Date(Date.UTC(year, 0, 1));
  const yearEnd = new Date(Date.UTC(year, 11, 31));
  return buildFormat2276(data)
    .map((row) => {
      const e = employees.get(row.employeeId);
      const hire = e?.hireDate ? dateOnly(e.hireDate) : null;
      const termination = e?.terminationDate ? dateOnly(e.terminationDate) : null;
      const periodFrom = hire && hire > yearStart ? hire : yearStart;
      const periodTo = termination && termination < yearEnd ? termination : yearEnd;
      const totalIngresosBrutos = round2(
        row.pagosSalarios + row.pagosPrestacionesSociales + row.otrosPagos + row.cesantiasInteresesPagados + row.cesantiasConsignadasFondo
      );
      return { ...row, year, periodFrom, periodTo, totalIngresosBrutos };
    })
    .sort((a, b) => `${a.firstSurname} ${a.firstName}`.localeCompare(`${b.firstSurname} ${b.firstName}`));
}

/** Fecha sin hora (UTC a medianoche): las fechas de ingreso/retiro se guardan como dia, no como instante. */
function dateOnly(d: Date): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
}
