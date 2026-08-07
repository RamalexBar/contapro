import type { FixedAssetRecord, IFixedAssetRepository } from "../../domain/fixed-asset.repository";

export class ListFixedAssetsUseCase {
  constructor(private readonly repo: IFixedAssetRepository) {}

  execute(): Promise<FixedAssetRecord[]> {
    return this.repo.list();
  }
}
