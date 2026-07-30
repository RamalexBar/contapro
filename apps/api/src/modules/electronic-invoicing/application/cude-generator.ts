import { createHash } from "node:crypto";

export interface CudeInput {
  fullNumber: string; // numero de la nota, ej "NC1"
  issueDate: Date;
  amount: number; // valor total de la nota
  taxAmount: number; // impuesto de la nota (0 si no discrimina IVA)
  issuerNit: string; // solo digitos, sin digito de verificacion
  buyerDocumentNumber: string;
  technicalKey: string; // ClTec -- DIAN_TECHNICAL_KEY
  environment: "HABILITACION" | "PRODUCCION";
  /** Codigo DIAN del tipo de nota (credito/debito) -- ver constants.ts, SIN VERIFICAR. */
  noteTypeCode: string;
  /** CUFE de la factura original que esta nota afecta. */
  referenceCufe: string;
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
 * Genera el CUDE (Codigo Unico de Documento Electronico) para notas credito/debito: un digest
 * SHA-384 de una concatenacion de campos de la nota, siguiendo la misma logica que el CUFE de
 * facturas (`cufe-generator.ts`) pero incorporando el tipo de nota y el CUFE del documento
 * original referenciado, como exige el modelo de la DIAN para notas.
 *
 * ORDEN DE CONCATENACION SIN VERIFICAR contra el Anexo Tecnico DIAN vigente -- igual que el
 * CUFE, esta es la mejor comprension documentada disponible, no una implementacion confirmada.
 * Verificar antes de cualquier envio real (ver README del modulo). Funcion pura con entrada
 * plana y nombrada por la misma razon que `generateCufe`: reordenar campos es un cambio de una
 * sola funcion.
 *
 * Igual que con technicalKey vacio en generateCufe: no lanza si faltan credenciales, para no
 * bloquear la generacion local antes de tener habilitacion real.
 */
export function generateCude(input: CudeInput): string {
  const environmentCode = input.environment === "PRODUCCION" ? "1" : "2";

  const raw =
    input.fullNumber +
    formatDate(input.issueDate) +
    formatTime(input.issueDate) +
    formatDecimal(input.amount) +
    formatDecimal(input.taxAmount) +
    input.issuerNit +
    input.buyerDocumentNumber +
    input.noteTypeCode +
    input.referenceCufe +
    input.technicalKey +
    environmentCode;

  return createHash("sha384").update(raw).digest("hex");
}
