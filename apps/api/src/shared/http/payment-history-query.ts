import type { Request } from "express";
import { ValidationError } from "../errors/app-error";

/** ?from=AAAA-MM-DD&to=AAAA-MM-DD (dias completos, hora de Colombia) para los historiales de recibos. */
export function parseDateRange(req: Request): { from?: Date; to?: Date } {
  const parse = (v: unknown, endOfDay: boolean) => {
    if (typeof v !== "string" || v === "") return undefined;
    if (!/^\d{4}-\d{2}-\d{2}$/.test(v)) throw new ValidationError("Las fechas van en formato AAAA-MM-DD");
    return new Date(`${v}T${endOfDay ? "23:59:59.999" : "00:00:00.000"}-05:00`);
  };
  return { from: parse(req.query.from, false), to: parse(req.query.to, true) };
}

const METHOD_LABELS: Record<string, string> = {
  CASH: "Efectivo",
  CARD: "Tarjeta",
  TRANSFER: "Transferencia",
  WOMPI: "Pago en linea (Wompi)",
};

export function paymentMethodLabel(method: string): string {
  return METHOD_LABELS[method] ?? method;
}
