export interface SalesCommissionSchemeRecord {
  id: string;
  sellerUserId: string;
  ratePercent: number;
  isActive: boolean;
}

export interface CreateSalesCommissionSchemeData {
  sellerUserId: string;
  ratePercent: number;
}

export interface UpdateSalesCommissionSchemeData {
  ratePercent?: number;
}

export interface ISalesCommissionSchemeRepository {
  create(data: CreateSalesCommissionSchemeData): Promise<SalesCommissionSchemeRecord>;
  list(): Promise<SalesCommissionSchemeRecord[]>;
  findByIdOrThrow(id: string): Promise<SalesCommissionSchemeRecord>;
  update(id: string, data: UpdateSalesCommissionSchemeData): Promise<SalesCommissionSchemeRecord>;
  deactivate(id: string): Promise<SalesCommissionSchemeRecord>;
  /** Esquemas activos -- usado por CalculateCommissionsUseCase. */
  listActive(): Promise<SalesCommissionSchemeRecord[]>;
}
