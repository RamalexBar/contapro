import type { Format1003Row, Format1008Row, Format1009Row } from "../domain/exogena-report.types";
import type { Format1001Row, Format1005Row, Format1006Row, Format1007Row, Format2276Row } from "./exogena-formats";

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
        r.pagoDeducible,
        r.pagoNoDeducible,
        r.ivaMayorValorCostoDeducible,
        r.ivaMayorValorCostoNoDeducible,
        r.retencionRentaPracticada,
        r.retencionRentaAsumida,
        r.retencionIvaResponsables,
        r.retencionIvaNoDomiciliados,
      ])
    )
    .join("\n");
}

export function generateFormat1005FlatFile(rows: Format1005Row[]): string {
  return rows.map((r) => toPipeLine([r.documentType, r.documentNumber, r.name, r.ivaDescontable, r.ivaDevolucionesVentas])).join("\n");
}

export function generateFormat1006FlatFile(rows: Format1006Row[]): string {
  return rows
    .map((r) => toPipeLine([r.documentType, r.documentNumber, r.name, r.ivaGenerado, r.impuestoConsumo, r.ivaRecuperadoDevolucionesCompras]))
    .join("\n");
}

export function generateFormat2276FlatFile(rows: Format2276Row[]): string {
  return rows
    .map((r) =>
      toPipeLine([
        r.documentType,
        r.documentNumber,
        r.firstSurname,
        r.secondSurname,
        r.firstName,
        r.otherNames,
        r.address,
        departmentCode(r.municipalityCode),
        r.municipalityCode ?? "",
        COUNTRY_CODE_COLOMBIA,
        r.pagosSalarios,
        r.pagosPrestacionesSociales,
        r.otrosPagos,
        r.cesantiasInteresesPagados,
        r.cesantiasConsignadasFondo,
        r.aportesSalud,
        r.aportesPensionFsp,
        r.retencionFuente,
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
        r.conceptoIngreso,
        r.documentType,
        r.documentNumber,
        r.name,
        COUNTRY_CODE_COLOMBIA,
        departmentCode(r.municipalityCode),
        r.municipalityCode ?? "",
        r.valorIngreso,
        r.devolucionesRebajasDescuentos,
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
