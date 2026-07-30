import { createHash } from "node:crypto";

export interface CudsInput {
  fullNumber: string; // numero del documento soporte, ej "DS1"
  issueDate: Date;
  subtotal: number;
  taxAmount: number;
  total: number;
  issuerNit: string; // NIT de la propia empresa (quien emite el documento soporte), sin DV
  supplierDocumentNumber: string; // documento del proveedor no obligado a facturar
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
 * Genera el CUDS (Codigo Unico de Documento Soporte) para compras a proveedores no obligados a
 * facturar electronicamente: un digest SHA-384 de una concatenacion de campos del documento,
 * siguiendo la misma logica que el CUFE/CUDE (`cufe-generator.ts`/`cude-generator.ts`). A
 * diferencia de una nota, el documento soporte no referencia otro documento -- es el documento
 * original de esa compra, por eso no lleva un campo de referencia.
 *
 * ORDEN DE CONCATENACION SIN VERIFICAR contra el Anexo Tecnico DIAN vigente -- de los tres
 * generadores del modulo (CUFE/CUDE/CUDS), este es el que tiene MENOS documentacion publica
 * disponible para contrastar. Tratar como la aproximacion mas especulativa hasta poder
 * verificarla contra un ejemplo real de la DIAN (ver README del modulo).
 *
 * Igual que generateCufe/generateCude: no lanza si technicalKey esta vacio, para no bloquear la
 * generacion local antes de tener habilitacion real.
 */
export function generateCuds(input: CudsInput): string {
  const environmentCode = input.environment === "PRODUCCION" ? "1" : "2";

  const raw =
    input.fullNumber +
    formatDate(input.issueDate) +
    formatTime(input.issueDate) +
    formatDecimal(input.subtotal) +
    formatDecimal(input.taxAmount) +
    formatDecimal(input.total) +
    input.issuerNit +
    input.supplierDocumentNumber +
    input.technicalKey +
    environmentCode;

  return createHash("sha384").update(raw).digest("hex");
}
