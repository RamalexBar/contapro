export interface BrandRecord {
  id: string;
  companyId: string;
  name: string;
  isActive: boolean;
}

export interface IBrandRepository {
  list(): Promise<BrandRecord[]>;
  create(name: string): Promise<BrandRecord>;
}
