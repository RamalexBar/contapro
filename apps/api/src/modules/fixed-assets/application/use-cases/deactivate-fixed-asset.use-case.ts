import type { AuditService } from "../../../audit/application/audit.service";
import type { FixedAssetRecord, IFixedAssetRepository } from "../../domain/fixed-asset.repository";

export class DeactivateFixedAssetUseCase {
  constructor(private readonly repo: IFixedAssetRepository, private readonly audit: AuditService) {}

  async execute(id: string): Promise<FixedAssetRecord> {
    const asset = await this.repo.deactivate(id);

    await this.audit.record({
      action: "FIXED_ASSET_DEACTIVATED",
      entityType: "FixedAsset",
      entityId: asset.id,
      description: `Activo fijo dado de baja: ${asset.name}`,
    });

    return asset;
  }
}
