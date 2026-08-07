export interface CostCenterRecord {
  id: string;
  code: string;
  name: string;
  isActive: boolean;
}

export interface CreateCostCenterData {
  code: string;
  name: string;
}

export interface UpdateCostCenterData {
  name?: string;
}

export interface ICostCenterRepository {
  create(data: CreateCostCenterData): Promise<CostCenterRecord>;
  list(): Promise<CostCenterRecord[]>;
  findByIdOrThrow(id: string): Promise<CostCenterRecord>;
  update(id: string, data: UpdateCostCenterData): Promise<CostCenterRecord>;
  deactivate(id: string): Promise<CostCenterRecord>;
}
