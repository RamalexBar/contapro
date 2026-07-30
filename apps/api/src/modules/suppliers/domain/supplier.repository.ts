export interface CreateSupplierData {
  name: string;
  nit: string;
  contactName?: string;
  phone?: string;
  email?: string;
  address?: string;
  /** false = requiere documento soporte electronico en cada compra (ver electronic-invoicing). */
  isObligatedToInvoice?: boolean;
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
  isObligatedToInvoice: boolean;
}

export interface ISupplierRepository {
  create(data: CreateSupplierData): Promise<SupplierRecord>;
  list(search?: string): Promise<SupplierRecord[]>;
  findByIdOrThrow(id: string): Promise<SupplierRecord>;
}
