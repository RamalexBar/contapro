const cop = new Intl.NumberFormat("es-CO", {
  style: "currency",
  currency: "COP",
  maximumFractionDigits: 0,
});

export function formatCOP(amount: number): string {
  return cop.format(amount);
}

/** Multi-moneda informativa (item 33 de docs/ALCANCE.md) -- formatCOP no se toca (93 call sites
 * existentes asumen COP). Usar solo para el total derivado (foreignTotal) de una venta/compra en
 * otra moneda. */
export function formatCurrency(amount: number, currencyCode: string): string {
  if (currencyCode === "COP") return formatCOP(amount);
  try {
    return new Intl.NumberFormat("es-CO", { style: "currency", currency: currencyCode, maximumFractionDigits: 2 }).format(amount);
  } catch {
    // Intl.NumberFormat lanza RangeError si currencyCode no es un ISO 4217 valido.
    return `${currencyCode} ${amount.toFixed(2)}`;
  }
}

export function round2(amount: number): number {
  return Math.round(amount * 100) / 100;
}

export function calculateTax(baseAmount: number, taxRatePercent: number): number {
  return round2(baseAmount * (taxRatePercent / 100));
}

export function applyDiscount(amount: number, discountPercent: number): number {
  return round2(amount * (1 - discountPercent / 100));
}
