import { apiFetch, BASE_URL, openPdfInNewTab } from "../../../lib/api-client";
import { useAuthStore } from "../../auth/hooks/useAuthStore";

/** Una fila de cualquier formato: identificacion del tercero y los valores del formato (ver la API). */
export interface ExogenaRow {
  documentType: string;
  documentNumber: string;
  name?: string;
  firstName?: string;
  otherNames?: string;
  firstSurname?: string;
  secondSurname?: string;
  municipalityCode: string | null;
  incompleto?: boolean;
  conceptoIncompleto?: boolean;
  [field: string]: string | number | boolean | null | undefined;
}

export type ExogenaFormatCode = "1001" | "1003" | "1005" | "1006" | "1007" | "1008" | "1009" | "2276";

/** 1008 y 1009 son saldos actuales; el resto, movimientos del año. */
export const NEEDS_YEAR: Record<ExogenaFormatCode, boolean> = {
  "1001": true,
  "1003": true,
  "1005": true,
  "1006": true,
  "1007": true,
  "1008": false,
  "1009": false,
  "2276": true,
};

function reportPath(format: ExogenaFormatCode, year: number): string {
  return `/reports/exogena/${format}${NEEDS_YEAR[format] ? `?year=${year}` : ""}`;
}

export function getExogenaReport(format: ExogenaFormatCode, year: number): Promise<{ data: ExogenaRow[] }> {
  return apiFetch(reportPath(format, year));
}

/** Descarga el archivo plano (texto, no JSON) -- apiFetch no sirve aqui porque siempre parsea
 * JSON, asi que se hace un fetch propio con el mismo header de autenticacion y se dispara la
 * descarga via un <a> temporal con un object URL, mismo patron estandar del navegador. */
export async function downloadExogenaFlatFile(format: ExogenaFormatCode, year: number): Promise<void> {
  const { accessToken } = useAuthStore.getState();
  const path = `/reports/exogena/${format}/download${NEEDS_YEAR[format] ? `?year=${year}` : ""}`;
  const res = await fetch(`${BASE_URL}${path}`, {
    headers: accessToken ? { Authorization: `Bearer ${accessToken}` } : {},
  });
  if (!res.ok) throw new Error(`No se pudo generar el archivo (HTTP ${res.status})`);
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `formato_${format}${NEEDS_YEAR[format] ? `_${year}` : ""}.txt`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

// ---- Certificados tributarios (retenciones a proveedores y formulario 220 de empleados) ----

export interface WithholdingCertificateSummary {
  supplier: { id: string; documentType: string; documentNumber: string; name: string };
  totals: { RETEFUENTE: number; RETEIVA: number; RETEICA: number; total: number };
}

export interface IncomeCertificateSummary {
  employeeId: string;
  documentType: string;
  documentNumber: string;
  firstName: string;
  otherNames: string;
  firstSurname: string;
  secondSurname: string;
  totalIngresosBrutos: number;
  retencionFuente: number;
}

export function listWithholdingCertificates(year: number) {
  return apiFetch<{ data: WithholdingCertificateSummary[] }>(`/reports/certificates/withholding?year=${year}`);
}

export function listIncomeCertificates(year: number) {
  return apiFetch<{ data: IncomeCertificateSummary[] }>(`/reports/certificates/income?year=${year}`);
}

export function openWithholdingCertificate(supplierId: string, year: number) {
  return openPdfInNewTab(`/reports/certificates/withholding/${supplierId}/pdf?year=${year}`);
}

export function openIncomeCertificate(employeeId: string, year: number) {
  return openPdfInNewTab(`/reports/certificates/income/${employeeId}/pdf?year=${year}`);
}
