import type { AuditService } from "../../../audit/application/audit.service";
import type { FixedAssetRecord, IFixedAssetRepository, UpdateFixedAssetData } from "../../domain/fixed-asset.repository";

export class UpdateFixedAssetUseCase {
  constructor(private readonly repo: IFixedAssetRepository, private readonly audit: AuditService) {}

  async execute(id: string, data: UpdateFixedAssetData): Promise<FixedAssetRecord> {
    const asset = await this.repo.update(id, data);

    await this.audit.record({
      action: "FIXED_ASSET_UPDATED",
      entityType: "FixedAsset",
      entityId: asset.id,
      description: `Activo fijo actualizado: ${asset.name}`,
    });

    return asset;
  }
}
