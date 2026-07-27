export interface CreateCustomerData {
  documentType: string;
  documentNumber: string;
  name: string;
  email?: string;
  phone?: string;
  address?: string;
  creditLimit?: number;
}

export interface CustomerRecord {
  id: string;
  documentType: string;
  documentNumber: string;
  name: string;
  creditLimit: number;
  currentBalance: number;
  isActive: boolean;
}

export interface ICustomerRepository {
  create(data: CreateCustomerData): Promise<CustomerRecord>;
  list(search?: string): Promise<CustomerRecord[]>;
}
