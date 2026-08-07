import type { Format1001Row, Format1003Row, Format1007Row, Format1008Row, Format1009Row } from "../domain/exogena-report.types";

/** Codigo DIAN de pais para Colombia (tabla de paises DIAN) -- fijo porque Customer/Supplier no
 * tienen campo de pais (se asume que el negocio solo transa localmente). */
const COUNTRY_CODE_COLOMBIA = "169";

/** Los dos primeros digitos de un codigo DANE de municipio (5 digitos) son el departamento. */
function departmentCode(municipalityCode: string | null): string {
  return municipalityCode ? municipalityCode.slice(0, 2) : "";
}

function toPipeLine(columns: Array<string | number>): string {
  return columns.map((c) => (typeof c === "number" ? c.toFixed(2) : c)).join("|");
}

/**
 * Genera el archivo plano delimitado por "|" en el layout de columnas publicado por la DIAN para
 * cada formato -- best-effort, sin validar contra el prevalidador oficial (ver README del
 * modulo). Sin encabezado, una fila por linea, terminado en salto de linea.
 */
export function generateFormat1001FlatFile(rows: Format1001Row[]): string {
  return rows
    .map((r) =>
      toPipeLine([
        r.conceptoPago,
        r.documentType,
        r.documentNumber,
        r.name,
        COUNTRY_CODE_COLOMBIA,
        departmentCode(r.municipalityCode),
        r.municipalityCode ?? "",
        r.valorPago,
        r.valorRetencionPracticada,
      ])
    )
    .join("\n");
}

export function generateFormat1003FlatFile(rows: Format1003Row[]): string {
  return rows
    .map((r) =>
      toPipeLine([
        r.conceptoRetencion ?? "",
        r.documentType,
        r.documentNumber,
        r.name,
        COUNTRY_CODE_COLOMBIA,
        r.valorBase,
        r.valorRetencion,
      ])
    )
    .join("\n");
}

export function generateFormat1007FlatFile(rows: Format1007Row[]): string {
  return rows
    .map((r) =>
      toPipeLine([
        r.documentType,
        r.documentNumber,
        r.name,
        COUNTRY_CODE_COLOMBIA,
        departmentCode(r.municipalityCode),
        r.municipalityCode ?? "",
        r.valorIngreso,
      ])
    )
    .join("\n");
}

export function generateFormat1008FlatFile(rows: Format1008Row[]): string {
  return rows.map((r) => toPipeLine([r.documentType, r.documentNumber, r.name, r.saldo])).join("\n");
}

export function generateFormat1009FlatFile(rows: Format1009Row[]): string {
  return rows.map((r) => toPipeLine([r.documentType, r.documentNumber, r.name, r.saldo])).join("\n");
}
