/**
 * Heuristica best-effort, NO una validacion formal -- los campos `phone` del schema son texto
 * libre sin formato exigido (ver README.md de este modulo). Quita todo lo que no sea digito y
 * antepone el indicativo de pais si el numero tiene longitud de celular colombiano (10 digitos)
 * y todavia no lo trae. La API de WhatsApp Cloud espera el numero en E.164 sin el "+" inicial.
 */
export function normalizeToE164(phone: string, defaultCountryCode = "57"): string {
  const digits = phone.replace(/\D/g, "");
  if (digits.length === 10) return `${defaultCountryCode}${digits}`;
  return digits;
}
