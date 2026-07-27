const cop = new Intl.NumberFormat("es-CO", {
  style: "currency",
  currency: "COP",
  maximumFractionDigits: 0,
});

export function formatCOP(amount: number): string {
  return cop.format(amount);
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
