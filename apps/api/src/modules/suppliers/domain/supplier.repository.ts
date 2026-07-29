export interface CreateSupplierData {
  name: string;
  nit: string;
  contactName?: string;
  phone?: string;
  email?: string;
  address?: string;
}

export interface SupplierRecord {
  id: string;
  name: string;
  nit: string;
  contactName: string | null;
  phone: string | null;
  email: string | null;
  address: string | null;
  isActive: boolean;
}

export interface ISupplierRepository {
  create(data: CreateSupplierData): Promise<SupplierRecord>;
  list(search?: string): Promise<SupplierRecord[]>;
  findByIdOrThrow(id: string): Promise<SupplierRecord>;
}
