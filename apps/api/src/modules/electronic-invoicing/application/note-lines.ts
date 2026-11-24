import type { ThirdPartyDocumentLineInput } from "../domain/third-party-invoicing-client";

const round2 = (value: number) => Math.round(value * 100) / 100;

/** Renglon de la venta original, lo minimo para repartir un valor por tarifa. */
export interface SaleLineForNote {
  taxPercent: number;
  /** Total de la linea con impuesto. */
  total: number;
}

/**
 * Renglones de una nota libre (descuento, ajuste de precio, intereses...) que solo tiene un valor
 * total con impuesto. Una rebaja sobre una venta con IVA tambien reduce el IVA, asi que el valor se
 * reparte entre las tarifas de la venta original en proporcion a lo que cada tarifa pesa en el
 * total, y de cada parte se separa la base: base = parte / (1 + tarifa).
 *
 * `taxable: false` (intereses de mora, gastos de cobranza) produce un solo renglon excluido de IVA.
 */
export function noteLinesFromAmount(params: {
  amount: number;
  description: string;
  saleLines: SaleLineForNote[];
  taxable: boolean;
}): ThirdPartyDocumentLineInput[] {
  const amount = round2(params.amount);
  const single = (taxPercent: number): ThirdPartyDocumentLineInput[] => [
    { code: "NOTA-1", description: params.description, quantity: 1, unitPrice: round2(amount / (1 + taxPercent / 100)), taxPercent },
  ];

  if (!params.taxable) return [{ ...single(0)[0]!, taxType: "EXCLUDED" }];

  const byRate = new Map<number, number>();
  for (const line of params.saleLines) {
    if (line.total <= 0) continue;
    byRate.set(line.taxPercent, (byRate.get(line.taxPercent) ?? 0) + line.total);
  }
  const grandTotal = [...byRate.values()].reduce((s, v) => s + v, 0);
  if (grandTotal <= 0) return [{ ...single(0)[0]!, taxType: "EXCLUDED" }];

  const rates = [...byRate.keys()].sort((a, b) => b - a);
  if (rates.length === 1) {
    const rate = rates[0]!;
    return rate > 0 ? single(rate) : [{ ...single(0)[0]!, taxType: "EXCLUDED" }];
  }

  // La ultima tarifa se lleva el residuo del redondeo, para que las partes sumen el valor exacto.
  let assigned = 0;
  return rates.map((rate, i) => {
    const portion = i === rates.length - 1 ? round2(amount - assigned) : round2((amount * byRate.get(rate)!) / grandTotal);
    assigned = round2(assigned + portion);
    return {
      code: `NOTA-${i + 1}`,
      description: `${params.description} (${rate > 0 ? `IVA ${rate}%` : "sin IVA"})`,
      quantity: 1,
      unitPrice: round2(portion / (1 + rate / 100)),
      taxPercent: rate,
      ...(rate > 0 ? {} : { taxType: "EXCLUDED" }),
    };
  });
}
