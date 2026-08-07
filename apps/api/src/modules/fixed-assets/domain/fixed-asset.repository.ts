export interface FixedAssetRecord {
  id: string;
  branchId: string;
  name: string;
  description: string | null;
  purchaseDate: Date;
  cost: number;
  salvageValue: number;
  usefulLifeMonths: number;
  accumulatedDepreciation: number;
  isActive: boolean;
  createdAt: Date;
}

export interface CreateFixedAssetData {
  branchId: string;
  name: string;
  description?: string;
  purchaseDate: Date;
  cost: number;
  salvageValue?: number;
  usefulLifeMonths: number;
}

export interface UpdateFixedAssetData {
  name?: string;
  description?: string;
}

export interface IFixedAssetRepository {
  create(data: CreateFixedAssetData): Promise<FixedAssetRecord>;
  list(): Promise<FixedAssetRecord[]>;
  findByIdOrThrow(id: string): Promise<FixedAssetRecord>;
  update(id: string, data: UpdateFixedAssetData): Promise<FixedAssetRecord>;
  deactivate(id: string): Promise<FixedAssetRecord>;
  /** Activos activos -- usado por CalculateDepreciationUseCase. */
  listActive(): Promise<FixedAssetRecord[]>;
  /** Suma `amount` al acumulado del activo -- usado por PostDepreciationEntryUseCase tras
   * contabilizar. */
  incrementAccumulatedDepreciation(id: string, amount: number): Promise<FixedAssetRecord>;
}
