import { round2 } from "@erp/shared-utils";
import type { WithholdingType } from "../domain/withholding-concept.repository";

/** Agrega una lista de retenciones aplicadas (por concepto) en el shape que esperan
 * PostSaleJournalEntryUseCase/PostPurchaseJournalEntryUseCase: una cuenta contable fija por
 * tipo, nunca por concepto. Reusado por create-sale/create-purchase (recien calculadas) y
 * authorize-discount (ya persistidas, al completar una venta que quedo PENDING_AUTHORIZATION). */
export function sumWithholdingsByType(withholdings: Array<{ type: WithholdingType; amount: number }>): Record<WithholdingType, number> {
  const byType: Record<WithholdingType, number> = { RETEFUENTE: 0, RETEICA: 0, RETEIVA: 0 };
  for (const w of withholdings) {
    byType[w.type] = round2(byType[w.type] + w.amount);
  }
  return byType;
}
