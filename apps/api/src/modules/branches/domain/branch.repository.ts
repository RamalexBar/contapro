export interface BranchRecord {
  id: string;
  name: string;
  code: string;
  address: string | null;
  phone: string | null;
  isMain: boolean;
  isActive: boolean;
}

export interface CreateBranchData {
  name: string;
  code: string;
  address?: string;
  phone?: string;
}

export interface IBranchRepository {
  list(companyId: string): Promise<BranchRecord[]>;
  countActive(companyId: string): Promise<number>;
  existsByCode(companyId: string, code: string): Promise<boolean>;
  create(companyId: string, data: CreateBranchData): Promise<BranchRecord>;
}
