import { round2 } from "@erp/shared-utils";
import type { AuditService } from "../../../audit/application/audit.service";
import type { IFixedAssetRepository } from "../../domain/fixed-asset.repository";
import type { DepreciationEntryRecord, IDepreciationEntryRepository } from "../../domain/depreciation-entry.repository";

/**
 * Calcula (o recalcula) las entradas de depreciacion de un periodo (item 39 de docs/ALCANCE.md):
 * linea recta, `cuota = (costo - valor residual) / vida util en meses`, ajustada en el ultimo
 * periodo para no pasarse de la base depreciable. Excluye activos comprados despues del periodo y
 * activos ya totalmente depreciados. Recalcular actualiza las entradas que siguen en CALCULATED
 * pero NUNCA toca una ya POSTED -- ver upsertForPeriod.
 */
export class CalculateDepreciationUseCase {
  constructor(
    private readonly fixedAssetRepo: IFixedAssetRepository,
    private readonly entryRepo: IDepreciationEntryRepository,
    private readonly audit: AuditService
  ) {}

  async execute(year: number, month: number): Promise<DepreciationEntryRecord[]> {
    const assets = await this.fixedAssetRepo.listActive();
    // Limite exclusivo del periodo: un activo comprado el mismo mes o antes ya deprecia.
    const periodEnd = new Date(year, month, 1);

    const results: DepreciationEntryRecord[] = [];
    for (const asset of assets) {
      if (asset.purchaseDate >= periodEnd) continue;

      const depreciableBase = round2(asset.cost - asset.salvageValue);
      const remaining = round2(depreciableBase - asset.accumulatedDepreciation);
      if (remaining <= 0) continue;

      const monthlyQuota = round2(depreciableBase / asset.usefulLifeMonths);
      const amount = Math.min(monthlyQuota, remaining);

      const entry = await this.entryRepo.upsertForPeriod({ fixedAssetId: asset.id, year, month, amount });
      if (entry) {
        results.push(entry);
        await this.audit.record({
          action: "DEPRECIATION_CALCULATED",
          entityType: "DepreciationEntry",
          entityId: entry.id,
          description: `Depreciacion calculada para el activo ${asset.name} (${year}-${month}): ${amount}`,
        });
      }
    }

    return results;
  }
}
