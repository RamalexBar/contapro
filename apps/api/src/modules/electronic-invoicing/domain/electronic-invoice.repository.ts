import type { IElectronicDocumentSubmissionRepository } from "./electronic-document-submission.repository";

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
  /** Numero de resolucion DIAN administrativo (InvoiceNumberingResolution.resolutionNumber) --
   * necesario para GenerateElectronicInvoiceUseCase cuando factura via proveedor tecnologico
   * (ver domain/third-party-invoicing-client.ts), MATIAS lo exige como campo separado del prefijo. */
  resolutionNumber: string;
  cufe: string;
  issueDate: Date;
  status: string;
  createdAt: Date;
}

export interface ElectronicInvoiceWithXml extends ElectronicInvoiceRecord {
  xmlContent: string;
  signedXmlContent: string | null;
  dianTrackingId: string | null;
  rejectionReason: string | null;
}

export interface ApplyThirdPartyInvoiceResultInput {
  status: "ACCEPTED" | "REJECTED";
  /** CUFE real del proveedor -- sobrescribe el generado localmente en claimNumberAndGenerate. */
  cufe: string;
  /** XML firmado del proveedor; vacio si REJECTED (se deja el xmlContent local sin tocar). */
  signedXmlContent: string;
  rejectionReason?: string;
  rawResponse: string;
}

export interface IElectronicInvoiceRepository extends IElectronicDocumentSubmissionRepository {
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

  /**
   * Aplica el resultado de un proveedor tecnologico (IThirdPartyInvoicingClient), ver README del
   * modulo. A diferencia de markAccepted/markRejected (heredados de
   * IElectronicDocumentSubmissionRepository, que asumen que el CUFE/XML ya guardado en GENERATED
   * es el definitivo), esto SOBRESCRIBE cufe/xmlContent con el valor real que devolvio el
   * proveedor -- el CUFE generado localmente por Contapro nunca es el CUFE oficial de una
   * factura emitida via proveedor (ver aviso en generate-electronic-invoice.use-case.ts).
   */
  applyThirdPartySubmissionResult(id: string, result: ApplyThirdPartyInvoiceResultInput): Promise<void>;
}
