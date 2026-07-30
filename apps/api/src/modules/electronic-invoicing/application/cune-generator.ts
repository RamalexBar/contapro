import { createHash } from "node:crypto";

export interface CuneInput {
  fullNumber: string; // numero del documento de nomina, ej "NE1"
  periodStart: Date;
  periodEnd: Date;
  issueDate: Date; // fecha de generacion (distinta del periodo)
  grossTotal: number; // total devengado
  totalDeductions: number;
  netPay: number;
  issuerNit: string; // NIT del empleador, sin DV
  employeeDocumentNumber: string;
  technicalKey: string; // ClTec -- DIAN_TECHNICAL_KEY
  environment: "HABILITACION" | "PRODUCCION";
}

function formatDecimal(value: number): string {
  return value.toFixed(2);
}

function formatDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

/** Hora local Bogota (UTC-5 fijo, Colombia no usa horario de verano). */
function formatTime(date: Date): string {
  const bogota = new Date(date.getTime() - 5 * 60 * 60 * 1000);
  const hh = String(bogota.getUTCHours()).padStart(2, "0");
  const mm = String(bogota.getUTCMinutes()).padStart(2, "0");
  const ss = String(bogota.getUTCSeconds()).padStart(2, "0");
  return `${hh}:${mm}:${ss}-05:00`;
}

/**
 * Genera el CUNE (Codigo Unico de Nomina Electronica): un digest SHA-384 de una concatenacion
 * de campos del documento de nomina, siguiendo la misma logica de diseño que
 * CUFE/CUDE/CUDS (`cufe-generator.ts`/`cude-generator.ts`/`cuds-generator.ts`).
 *
 * ORDEN DE CONCATENACION SIN VERIFICAR contra el Anexo Tecnico de la Resolucion 000013 de 2021
 * -- de los cuatro generadores del modulo, este es el que tiene MENOS documentacion publica
 * disponible para contrastar (la nomina electronica esta documentada con mucha menos densidad
 * publica que la factura electronica). Tratar como la aproximacion mas especulativa de todas
 * hasta poder verificarla contra un ejemplo real de la DIAN (ver README del modulo).
 *
 * Igual que los demas generadores: no lanza si technicalKey esta vacio, para no bloquear la
 * generacion local antes de tener habilitacion real.
 */
export function generateCune(input: CuneInput): string {
  const environmentCode = input.environment === "PRODUCCION" ? "1" : "2";

  const raw =
    input.fullNumber +
    formatDate(input.periodStart) +
    formatDate(input.periodEnd) +
    formatDate(input.issueDate) +
    formatTime(input.issueDate) +
    formatDecimal(input.grossTotal) +
    formatDecimal(input.totalDeductions) +
    formatDecimal(input.netPay) +
    input.issuerNit +
    input.employeeDocumentNumber +
    input.technicalKey +
    environmentCode;

  return createHash("sha384").update(raw).digest("hex");
}
