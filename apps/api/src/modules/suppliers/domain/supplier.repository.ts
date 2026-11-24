export interface CreateSupplierData {
  name: string;
  nit: string;
  contactName?: string;
  phone?: string;
  email?: string;
  address?: string;
  /** false = requiere documento soporte electronico en cada compra (ver electronic-invoicing). */
  isObligatedToInvoice?: boolean;
  // Item 37 de docs/ALCANCE.md (informacion exogena DIAN). documentType default "NIT" a nivel de
  // schema si se omite.
  documentType?: string;
  municipalityCode?: string;
  /** Declarante de renta (cambia la tarifa de retencion de algunos conceptos). Default true. */
  incomeTaxDeclarant?: boolean;
}

/** Edicion de un proveedor: solo los campos que llegan. */
export type UpdateSupplierData = Partial<CreateSupplierData>;

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
  documentType: string;
  municipalityCode: string | null;
  incomeTaxDeclarant: boolean;
}

export interface ISupplierRepository {
  create(data: CreateSupplierData): Promise<SupplierRecord>;
  list(search?: string): Promise<SupplierRecord[]>;
  findByIdOrThrow(id: string): Promise<SupplierRecord>;
  update(id: string, data: UpdateSupplierData): Promise<SupplierRecord>;
  /** Usado por la API publica para resolver/crear un proveedor por NIT sin que el POS externo
   * conozca el id interno de Contapro -- mismo criterio que ICustomerRepository.findByDocumentNumber. */
  findByNit(nit: string): Promise<SupplierRecord | null>;
}
