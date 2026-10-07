import { createColumnMatcher, downloadWorkbook, readSpreadsheet, type ColumnMapping, type ParsedSheet } from "../../../lib/spreadsheet";

/** Importacion del plan de cuentas propio (catalogo NIIF o PUC extendido) -- ver lib/spreadsheet. */

export type ChartField = "code" | "name";

export const CHART_FIELDS: { field: ChartField; label: string }[] = [
  { field: "code", label: "Codigo de la cuenta" },
  { field: "name", label: "Nombre de la cuenta" },
];

const matcher = createColumnMatcher<ChartField>(["code", "name"], {
  code: ["codigo", "codigo cuenta", "codigo de la cuenta", "cod cuenta", "codigo contable", "cuenta", "numero de cuenta", "no cuenta", "cuenta contable", "cod"],
  name: ["nombre", "nombre cuenta", "nombre de la cuenta", "descripcion", "descripcion cuenta", "detalle", "nombre cuenta contable"],
});

export type ChartColumnMapping = ColumnMapping<ChartField>;
export const detectChartMapping = matcher.detectMapping;
export const readChartSpreadsheet = (file: File) => readSpreadsheet(file, matcher.isKnownHeader);

/** Codigo como texto aunque Excel lo haya guardado como numero (110505 -> "110505"). */
function cellToText(value: unknown): string {
  return String(value ?? "").trim();
}

export function buildChartRows(sheet: ParsedSheet, mapping: ChartColumnMapping) {
  const rows = sheet.rows.map(({ cells }) => ({
    code: mapping.code >= 0 ? cellToText(cells[mapping.code]) : "",
    name: mapping.name >= 0 ? cellToText(cells[mapping.name]) : "",
  }));
  return { rows, rowNumbers: sheet.rows.map((r) => r.rowNumber) };
}

export function downloadChartTemplate() {
  return downloadWorkbook(
    "plantilla-plan-de-cuentas-contapro.xlsx",
    "Plan de cuentas",
    [
      ["Codigo", "Nombre"],
      ["11", "Efectivo y equivalentes al efectivo"],
      ["1105", "Caja"],
      ["110505", "Caja general"],
      ["110510", "Cajas menores"],
      ["1110", "Bancos"],
      ["111005", "Moneda nacional"],
    ],
    [12, 44]
  );
}
