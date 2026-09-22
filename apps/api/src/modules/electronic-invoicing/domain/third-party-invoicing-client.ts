export interface ThirdPartyInvoiceLineInput {
  description: string;
  code: string;
  quantity: number;
  unitPrice: number;
  taxPercent: number;
  taxAmount: number;
  lineTotal: number;
}

export interface ThirdPartyInvoiceCustomerInput {
  documentType: string; // CC, NIT, CE, PASSPORT (mismo catalogo que Customer.documentType)
  documentNumber: string;
  name: string;
  email: string | null;
  phone: string | null;
  address: string | null;
  postalCode: string | null;
  countryId: string | null;
  cityId: string | null;
  identityDocumentId: string | null;
  typeOrganizationId: string | null;
  taxRegimeId: string | null;
  taxLevelId: string | null;
}

export interface ThirdPartyInvoiceInput {
  resolutionNumber: string;
  prefix: string;
  documentNumber: number;
  issueDate: Date;
  subtotal: number;
  taxTotal: number;
  total: number;
  customer: ThirdPartyInvoiceCustomerInput;
  lines: ThirdPartyInvoiceLineInput[];
}

export interface ThirdPartyInvoiceResult {
  status: "ACCEPTED" | "REJECTED";
  /** CUFE real devuelto por el proveedor -- NO el generado localmente por Contapro (ver aviso en
   * generate-electronic-invoice.use-case.ts: no van a coincidir, distinto algoritmo/campos). */
  cufe: string;
  /** XML UBL 2.1 completo, ya firmado por el proveedor (decodificado de base64). Vacio si REJECTED. */
  signedXmlContent: string;
  rejectionReason?: string;
  /** Respuesta cruda del proveedor (JSON stringificado) -- se guarda en ElectronicInvoice.dianResponseXml
   * (nombre historico del campo, reusado aqui) solo para auditoria/debug. */
  rawResponse: string;
}

/**
 * Puerto para proveedores tecnologicos DIAN que reciben datos de factura estructurados (no XML
 * ya firmado como IDianClient) y devuelven el resultado final -- CUFE, XML firmado, estado -- en
 * la misma llamada (sincrono, sin submit+poll: a diferencia del envio directo a la DIAN, el
 * proveedor ya resuelve la generacion de CUFE/XML/firma/transmision el mismo, ver README del
 * modulo). Implementado por FactusInvoicingClient (infrastructure/factus-invoicing-client.ts),
 * verificado contra su sandbox real -- un proveedor previo (MATIAS) implemento este mismo puerto
 * pero se elimino del codebase el 2026-09-21 (decision del usuario, ver README). Este puerto
 * queda como esta para que sumar otro proveedor el dia de mañana no toque el caso de uso.
 */
export interface IThirdPartyInvoicingClient {
  submitInvoice(apiToken: string, input: ThirdPartyInvoiceInput): Promise<ThirdPartyInvoiceResult>;
}
