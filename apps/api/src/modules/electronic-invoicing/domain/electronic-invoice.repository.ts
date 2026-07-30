export interface GenerateElectronicInvoiceData {
  saleId: string;
  branchId: string;
  issueDate: Date;
  customerDocumentType: string;
  customerDocumentNumber: string;
  customerName: string;
  subtotal: number;
  taxTotal: number;
  total: number;
  environment: "HABILITACION" | "PRODUCCION";
}

export interface ElectronicInvoiceRecord {
  id: string;
  saleId: string;
  branchId: string;
  prefix: string;
  number: number;
  fullNumber: string;
  cufe: string;
  issueDate: Date;
  status: string;
  createdAt: Date;
}

export interface ElectronicInvoiceWithXml extends ElectronicInvoiceRecord {
  xmlContent: string;
}

export interface IElectronicInvoiceRepository {
  /**
   * Reclama atomicamente el siguiente numero de la resolucion DIAN vigente para branchId
   * (o la resolucion "toda la empresa", branchId null, si no hay una especifica de sucursal)
   * y crea el ElectronicInvoice + actualiza Sale.cufe/Sale.invoiceXmlUrl, todo en una sola
   * transaccion. El CUFE depende del numero final reclamado, por eso `build` se invoca DESPUES
   * de reclamar el numero pero DENTRO de la misma transaccion.
   * Lanza ConflictError (409) si no hay una resolucion activa y vigente, o si la resolucion
   * encontrada ya agoto su rango autorizado.
   */
  claimNumberAndGenerate(
    data: GenerateElectronicInvoiceData,
    build: (fullNumber: string, prefix: string, number: number) => { cufe: string; xmlContent: string }
  ): Promise<ElectronicInvoiceRecord>;

  findBySaleId(saleId: string): Promise<ElectronicInvoiceWithXml | null>;
}
