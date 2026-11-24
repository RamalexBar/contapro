import { round2 } from "@erp/shared-utils";
import { ValidationError } from "../../../../shared/errors/app-error";

export interface PaymentInput {
  method: string;
  amount: number;
}

/**
 * Deja los pagos de una venta exactamente en el neto a cobrar: si el cliente entrego mas efectivo,
 * el sobrante es vuelto y se descuenta del efectivo (primero del ultimo pago en efectivo). Antes la
 * venta se guardaba con el efectivo recibido completo: el comprobante no cuadraba ("debitos X vs
 * creditos Y"), la API respondia error, pero la venta ya habia quedado guardada y el inventario
 * descontado, sin contabilidad ni factura. Sobrante en tarjeta, transferencia o credito no es vuelto:
 * se rechaza. Devuelve los pagos ajustados y el vuelto.
 */
export function settlePayments(payments: PaymentInput[], netTotal: number): { payments: PaymentInput[]; change: number } {
  const total = round2(payments.reduce((s, p) => s + p.amount, 0));
  let excess = round2(total - netTotal);
  if (excess <= 0) return { payments, change: 0 };

  const adjusted = payments.map((p) => ({ ...p }));
  for (let i = adjusted.length - 1; i >= 0 && excess > 0; i--) {
    const p = adjusted[i]!;
    if (p.method !== "CASH") continue;
    const cut = Math.min(p.amount, excess);
    p.amount = round2(p.amount - cut);
    excess = round2(excess - cut);
  }
  if (excess > 0) {
    throw new ValidationError(
      `Los pagos (${total}) superan el neto a cobrar (${netTotal}) en ${excess} y ese sobrante no es efectivo: corrija el valor de la tarjeta, transferencia o credito`
    );
  }
  return { payments: adjusted.filter((p) => p.amount > 0), change: round2(total - netTotal) };
}
