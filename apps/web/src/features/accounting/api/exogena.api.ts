import { apiFetch, BASE_URL } from "../../../lib/api-client";
import { useAuthStore } from "../../auth/hooks/useAuthStore";

export interface ThirdPartyInfo {
  documentType: string;
  documentNumber: string;
  name: string;
  municipalityCode: string | null;
  incompleto: boolean;
}

export interface Format1001Row extends ThirdPartyInfo {
  supplierId: string;
  conceptoPago: string;
  valorPago: number;
  valorRetencionPracticada: number;
}

export interface Format1003Row extends ThirdPartyInfo {
  supplierId: string;
  conceptoRetencion: string | null;
  conceptoIncompleto: boolean;
  valorBase: number;
  valorRetencion: number;
}

export interface Format1007Row extends ThirdPartyInfo {
  customerId: string;
  valorIngreso: number;
}

export interface Format1008Row extends ThirdPartyInfo {
  customerId: string;
  saldo: number;
}

export interface Format1009Row extends ThirdPartyInfo {
  supplierId: string;
  saldo: number;
}

export type ExogenaFormatCode = "1001" | "1003" | "1007" | "1008" | "1009";

const NEEDS_YEAR: Record<ExogenaFormatCode, boolean> = {
  "1001": true,
  "1003": true,
  "1007": true,
  "1008": false,
  "1009": false,
};

function reportPath(format: ExogenaFormatCode, year: number): string {
  return `/reports/exogena/${format}${NEEDS_YEAR[format] ? `?year=${year}` : ""}`;
}

export function getExogenaReport(
  format: ExogenaFormatCode,
  year: number
): Promise<{ data: (Format1001Row | Format1003Row | Format1007Row | Format1008Row | Format1009Row)[] }> {
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
