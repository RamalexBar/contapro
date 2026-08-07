import { round2 } from "@erp/shared-utils";
import { ValidationError } from "../../../../shared/errors/app-error";
import type { ReceivableInput, SalePayment } from "../domain/sale.repository";

/** 30 dias: mismo criterio de "valor asumido, documentado" que TRIAL_PERIOD_DAYS en
 * register-company.use-case.ts. Se usa cuando no se especifica un vencimiento explicito, y
 * SIEMPRE en el camino de AuthorizeDiscountUseCase (la venta necesito autorizacion de descuento
 * antes de completarse, y el dueDate original del request de creacion no se persiste mientras
 * espera -- Sale no tiene columna dueDate propia, vive solo en AccountReceivable -- asi que ese
 * caso borde siempre cae en el default, contado desde el momento de la autorizacion, no de la
 * venta original). */
const DEFAULT_DUE_DAYS = 30;

/** Detecta si una venta trae un pago method="CREDIT" (mecanismo que ya existia y ya satisface la
 * validacion de pago + la contabilizacion como "Clientes" en PostSaleJournalEntryUseCase) y arma
 * los datos para crear su AccountReceivable (item 31, modulo `collections`). Null si no aplica. */
export function resolveReceivableInput(
  payments: Pick<SalePayment, "method" | "amount">[],
  customerId: string | undefined,
  dueDate: Date | undefined
): ReceivableInput | null {
  const creditAmount = round2(payments.filter((p) => p.method === "CREDIT").reduce((sum, p) => sum + p.amount, 0));
  if (creditAmount === 0) return null;

  if (!customerId) {
    throw new ValidationError("Una venta con pago a credito (CREDIT) requiere un cliente asociado");
  }

  return { customerId, amount: creditAmount, dueDate: dueDate ?? defaultDueDate() };
}

function defaultDueDate(): Date {
  const d = new Date();
  d.setDate(d.getDate() + DEFAULT_DUE_DAYS);
  return d;
}
