/**
 * Calcula el digito de verificacion (DV) de un NIT colombiano segun el algoritmo de la DIAN.
 */
const NIT_WEIGHTS = [3, 7, 13, 17, 19, 23, 29, 37, 41, 43, 47, 53, 59, 67, 71];

export function calculateNitCheckDigit(nit: string): number {
  const digits = nit.replace(/\D/g, "").split("").reverse().map(Number);
  const sum = digits.reduce((acc, digit, index) => {
    const weight = NIT_WEIGHTS[index] ?? 0;
    return acc + digit * weight;
  }, 0);
  const remainder = sum % 11;
  return remainder > 1 ? 11 - remainder : remainder;
}

export function isValidNit(nitWithDv: string): boolean {
  const clean = nitWithDv.replace(/[^0-9-]/g, "");
  const [nit, dv] = clean.split("-");
  if (!nit || !dv) return false;
  return calculateNitCheckDigit(nit) === Number(dv);
}

export function isValidCedula(value: string): boolean {
  const clean = value.replace(/\D/g, "");
  return clean.length >= 6 && clean.length <= 10;
}
