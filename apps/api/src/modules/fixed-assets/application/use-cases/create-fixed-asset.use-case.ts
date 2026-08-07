import { ValidationError } from "../../../../shared/errors/app-error";
import type { AuditService } from "../../../audit/application/audit.service";
import type { CreateFixedAssetData, FixedAssetRecord, IFixedAssetRepository } from "../../domain/fixed-asset.repository";

export class CreateFixedAssetUseCase {
  constructor(private readonly repo: IFixedAssetRepository, private readonly audit: AuditService) {}

  async execute(data: CreateFixedAssetData): Promise<FixedAssetRecord> {
    if ((data.salvageValue ?? 0) >= data.cost) {
      throw new ValidationError("El valor residual debe ser menor que el costo del activo");
    }

    const asset = await this.repo.create(data);

    await this.audit.record({
      action: "FIXED_ASSET_CREATED",
      entityType: "FixedAsset",
      entityId: asset.id,
      description: `Activo fijo creado: ${asset.name} (costo ${asset.cost})`,
    });

    return asset;
  }
}
