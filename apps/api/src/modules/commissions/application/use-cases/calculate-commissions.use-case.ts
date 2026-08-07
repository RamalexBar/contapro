import { round2 } from "@erp/shared-utils";
import type { AuditService } from "../../../audit/application/audit.service";
import type { ISaleRepository } from "../../../pos/sale/domain/sale.repository";
import type { ISalesCommissionSchemeRepository } from "../../domain/sales-commission-scheme.repository";
import type { CommissionSettlementRecord, ICommissionSettlementRepository } from "../../domain/commission-settlement.repository";

/**
 * Calcula (o recalcula) las liquidaciones de comisiones de un periodo (item 38 de docs/ALCANCE.md):
 * suma Sale.subtotal por vendedor (ventas COMPLETED/RETURNED_PARTIAL del mes) y aplica la tarifa
 * de cada esquema activo. Recalcular un periodo actualiza los montos de las liquidaciones que
 * siguen en CALCULATED (por si hay ventas nuevas antes de pagar) pero NUNCA toca una ya PAID --
 * ver upsertForPeriod. Un vendedor con esquema activo pero sin ventas ese mes no genera fila.
 */
export class CalculateCommissionsUseCase {
  constructor(
    private readonly saleRepo: ISaleRepository,
    private readonly schemeRepo: ISalesCommissionSchemeRepository,
    private readonly settlementRepo: ICommissionSettlementRepository,
    private readonly audit: AuditService
  ) {}

  async execute(year: number, month: number): Promise<CommissionSettlementRecord[]> {
    const [sales, schemes] = await Promise.all([this.saleRepo.listForPeriod(year, month), this.schemeRepo.listActive()]);

    const basesBySeller = new Map<string, number>();
    for (const sale of sales) {
      basesBySeller.set(sale.sellerUserId, round2((basesBySeller.get(sale.sellerUserId) ?? 0) + sale.subtotal));
    }

    const results: CommissionSettlementRecord[] = [];
    for (const scheme of schemes) {
      const base = basesBySeller.get(scheme.sellerUserId);
      if (!base) continue;

      const commissionAmount = round2((base * scheme.ratePercent) / 100);
      const settlement = await this.settlementRepo.upsertForPeriod({
        sellerUserId: scheme.sellerUserId,
        year,
        month,
        salesBase: base,
        ratePercent: scheme.ratePercent,
        commissionAmount,
      });

      if (settlement) {
        results.push(settlement);
        await this.audit.record({
          action: "COMMISSION_CALCULATED",
          entityType: "CommissionSettlement",
          entityId: settlement.id,
          description: `Comision calculada para el vendedor ${scheme.sellerUserId} (${year}-${month}): ${commissionAmount}`,
        });
      }
    }

    return results;
  }
}
