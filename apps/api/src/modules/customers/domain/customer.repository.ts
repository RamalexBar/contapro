export interface CreateCustomerData {
  documentType: string;
  documentNumber: string;
  name: string;
  email?: string;
  phone?: string;
  address?: string;
  creditLimit?: number;
  // Item 35 de docs/ALCANCE.md (listas de precios): lista por defecto de este cliente, usada por
  // CreateSaleUseCase/CreateQuoteUseCase cuando la venta/cotizacion no fuerza una explicita.
  priceListId?: string;
  // Item 37 de docs/ALCANCE.md (informacion exogena DIAN): codigo DANE de municipio del tercero.
  municipalityCode?: string;
}

export interface CustomerRecord {
  id: string;
  documentType: string;
  documentNumber: string;
  name: string;
  // Se guarda desde el alta (create) pero hasta el item 31 (cobranza, modulo `collections`)
  // ningun caso de uso lo leia -- necesario para el checkout Wompi (customerEmail) y los
  // recordatorios de cobro.
  email: string | null;
  // Item 41 de docs/ALCANCE.md (envio de documentos por WhatsApp): se guarda desde el alta pero
  // hasta este item ningun caso de uso lo leia -- mismo patron que email arriba.
  phone: string | null;
  creditLimit: number;
  currentBalance: number;
  isActive: boolean;
  priceListId: string | null;
  municipalityCode: string | null;
}

export interface ICustomerRepository {
  create(data: CreateCustomerData): Promise<CustomerRecord>;
  list(search?: string): Promise<CustomerRecord[]>;
  findByIdOrThrow(id: string): Promise<CustomerRecord>;
  /** Endpoint angosto de un solo campo (`PATCH /customers/:id/price-list`) -- el modulo
   * `customers` no tiene edicion general hoy, mismo criterio que `PATCH /products/:id/price`. */
  updatePriceList(id: string, priceListId: string | null): Promise<CustomerRecord>;
}
