/** Una retencion practicada en el mes, de cualquier origen. */
export interface PracticedWithholding {
  source: "PURCHASE" | "PAYROLL" | "BENEFIT_SETTLEMENT";
  /** RETEFUENTE | RETEIVA | RETEICA; nomina y prestaciones son siempre RETEFUENTE (rentas de trabajo). */
  type: "RETEFUENTE" | "RETEIVA" | "RETEICA";
  /** Codigo del concepto (RF-COMPRAS...) en compras; null en nomina. */
  conceptCode: string | null;
  conceptName: string | null;
  base: number;
  amount: number;
}

/** Lee las retenciones practicadas por la empresa en un mes (compras, nomina y prestaciones). */
export interface IWithholdingReportReader {
  listForMonth(year: number, month: number): Promise<PracticedWithholding[]>;
}
