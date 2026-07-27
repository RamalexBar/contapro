export interface CategoryRecord {
  id: string;
  companyId: string;
  name: string;
  parentId: string | null;
  isActive: boolean;
}

export interface ICategoryRepository {
  list(): Promise<CategoryRecord[]>;
  create(name: string, parentId?: string): Promise<CategoryRecord>;
  findById(id: string): Promise<CategoryRecord | null>;
}
