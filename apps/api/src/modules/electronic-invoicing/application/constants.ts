/**
 * Identificacion generica DIAN para "consumidor final" (ventas sin cliente identificado,
 * Sale.customerId == null). VALOR SIN VERIFICAR contra el Anexo Tecnico DIAN vigente: el tipo
 * de documento y el numero exacto usados aqui son los mas comunmente citados para este caso,
 * pero deben confirmarse antes de cualquier envio real a la DIAN (ver README del modulo). Esta
 * aislado en una sola constante exportada precisamente para poder corregirlo despues sin tocar
 * ningun call site.
 */
export const DIAN_GENERIC_FINAL_CONSUMER = {
  documentType: "NIT",
  documentNumber: "222222222222",
  name: "Consumidor final",
} as const;

/**
 * Codigos DIAN de tipo de nota (para el CUDE, ver cude-generator.ts). VALORES SIN VERIFICAR
 * contra el Anexo Tecnico DIAN vigente -- los mas comunmente citados para nota credito/debito,
 * aislados aqui para poder corregirlos despues sin tocar ningun call site.
 */
export const DIAN_NOTE_TYPE_CODE = {
  CREDIT: "91",
  DEBIT: "92",
} as const;
