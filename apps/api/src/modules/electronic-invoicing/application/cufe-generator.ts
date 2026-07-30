import { createHash } from "node:crypto";

export interface CufeInput {
  fullNumber: string; // NumFac, ej "SETP990000001"
  issueDate: Date; // FecFac + HorFac derivan de aqui
  subtotal: number; // ValFac: base gravable (antes de impuestos)
  ivaAmount: number; // ValImp1 (codigo impuesto "01")
  consumptionTaxAmount: number; // ValImp2 (codigo impuesto "04", INC) -- 0 si no aplica
  icaAmount: number; // ValImp3 (codigo impuesto "03", ICA) -- 0 si no aplica
  total: number; // ValTot
  issuerNit: string; // NitFac, solo digitos, sin digito de verificacion
  buyerDocumentNumber: string; // NumAdq
  technicalKey: string; // ClTec -- DIAN_TECHNICAL_KEY
  environment: "HABILITACION" | "PRODUCCION"; // TipoAmbiente: 2 = pruebas (habilitacion), 1 = produccion
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
 * Genera el CUFE (Codigo Unico de Factura Electronica): un digest SHA-384 de una concatenacion
 * de campos de la factura, segun el algoritmo documentado en el Anexo Tecnico de la DIAN.
 *
 * ORDEN DE CONCATENACION SIN VERIFICAR contra el Anexo Tecnico DIAN vigente -- esta es la mejor
 * comprension documentada disponible, no una implementacion confirmada contra el spec oficial.
 * Un orden incorrecto produce un CUFE con forma valida (hash hexadecimal de 96 caracteres) que
 * fallaria silenciosamente la validacion real de la DIAN. Verificar antes de cualquier envio
 * real (ver README del modulo). Por eso esta funcion es pura y toma un objeto de entrada plano
 * y nombrado: reordenar campos despues es un cambio de una sola funcion, no un refactor.
 *
 * Si technicalKey esta vacio (sin credenciales de habilitacion aun, el default), igual se
 * genera un CUFE en vez de lanzar -- lanzar bloquearia la generacion local de XML antes de
 * tener habilitacion, que es justo el punto de esta iteracion. Ese CUFE generado con clave
 * tecnica vacia NO es valido ante la DIAN y debe regenerarse cuando existan credenciales reales.
 */
export function generateCufe(input: CufeInput): string {
  const environmentCode = input.environment === "PRODUCCION" ? "1" : "2";

  const raw =
    input.fullNumber +
    formatDate(input.issueDate) +
    formatTime(input.issueDate) +
    formatDecimal(input.subtotal) +
    "01" +
    formatDecimal(input.ivaAmount) +
    "04" +
    formatDecimal(input.consumptionTaxAmount) +
    "03" +
    formatDecimal(input.icaAmount) +
    formatDecimal(input.total) +
    input.issuerNit +
    input.buyerDocumentNumber +
    input.technicalKey +
    environmentCode;

  return createHash("sha384").update(raw).digest("hex");
}
