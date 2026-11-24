export interface ThirdPartyInvoiceLineInput {
  description: string;
  code: string;
  quantity: number;
  unitPrice: number;
  taxPercent: number;
  /** IVA (por defecto) | INC | EXEMPT | EXCLUDED */
  taxType?: string;
  taxAmount: number;
  lineTotal: number;
  /** Descuento de la linea en %, sobre quantity x unitPrice (unitPrice es antes del descuento). */
  discountPercent?: number;
}

/** Un pago de la venta, con el mismo metodo que SalePayment (CASH, CARD, TRANSFER, CREDIT, MIXED). */
export interface ThirdPartyPaymentInput {
  method: string;
  amount: number;
}

/** Retencion que le practican al vendedor; ratePercent sobre la base (ReteIVA: sobre el IVA). */
export interface ThirdPartyWithholdingInput {
  type: "RETEFUENTE" | "RETEICA" | "RETEIVA";
  ratePercent: number;
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
  /** Tributo del comprador: "01" responsable de IVA, "ZZ" no aplica (Customer.dianTaxRegimeId). */
  taxRegimeId: string | null;
  /** Responsabilidades fiscales separadas por coma, ej. "O-13,O-23" (Customer.dianTaxLevelId). */
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
  /** Sin pagos (factura manual, API publica) se informa un solo pago de contado. */
  payments?: ThirdPartyPaymentInput[];
  /** Vencimiento de la parte a credito. */
  dueDate?: Date | null;
  withholdings?: ThirdPartyWithholdingInput[];
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
  /** Nota credito o debito que referencia una factura ya emitida por el mismo proveedor. */
  submitNote(apiToken: string, input: ThirdPartyNoteInput): Promise<ThirdPartyDocumentResult>;
  /** Documento soporte en adquisiciones a no obligados a facturar. */
  submitSupportDocument(apiToken: string, input: ThirdPartySupportDocumentInput): Promise<ThirdPartyDocumentResult>;
  /** Nomina electronica de un empleado por un mes (uniqueCode = CUNE). */
  submitPayroll(apiToken: string, input: ThirdPartyPayrollInput): Promise<ThirdPartyDocumentResult>;
}

/** Concepto liquidado en el mes, con los mismos codigos que PayrollItem (SALARY, VACATION_PAY...). */
export interface ThirdPartyPayrollItem {
  conceptCode: string;
  /** Dias u horas, segun el concepto. */
  quantity: number | null;
  /** Porcentaje (aportes) o valor unitario (horas), segun el concepto: ver PayrollItem.rate. */
  rate: number | null;
  amount: number;
  /** Para libranzas y otras deducciones. */
  description?: string;
}

export interface ThirdPartyPayrollInput {
  referenceCode: string;
  year: number;
  month: number;
  /** MONTHLY = un pago al mes; BIWEEKLY = dos quincenas consolidadas en el mismo documento. */
  periodicity: "MONTHLY" | "BIWEEKLY";
  /** Fecha de cada pago del mes (una por nomina aprobada). */
  paymentDates: Date[];
  payment: { method: "CASH" | "TRANSFER"; bankName: string | null; accountNumber: string | null };
  worker: {
    documentType: string;
    documentNumber: string;
    firstName: string;
    otherNames: string | null;
    firstSurname: string;
    secondSurname: string | null;
    address: string;
    municipalityCode: string;
    integralSalary: boolean;
    workerTypeCode: string;
    workerSubtypeCode: string;
    contractTypeCode: string;
    employeeCode: string;
    salary: number;
    entryDate: Date;
    retirementDate: Date | null;
    daysWorked: number;
  };
  items: ThirdPartyPayrollItem[];
  /** Neto esperado: se compara con el que calcula el proveedor. */
  netPay: number;
}

/** Renglon de una nota o documento soporte. unitPrice es antes de descuento e impuesto. */
export interface ThirdPartyDocumentLineInput {
  code: string;
  description: string;
  quantity: number;
  unitPrice: number;
  discountPercent?: number;
  taxPercent: number;
  /** IVA (por defecto) | INC | EXEMPT | EXCLUDED */
  taxType?: string;
}

export interface ThirdPartyNoteInput {
  kind: "CREDIT" | "DEBIT";
  /** Estable para el mismo documento: un reenvio devuelve el documento ya creado, no uno nuevo. */
  referenceCode: string;
  /** Numero legal de la factura referenciada, el que asigno el proveedor (ej. "SETP990042087"). */
  billNumber: string;
  /** Concepto de correccion DIAN (credito 1-6, debito 1-4, ver constants.ts). */
  conceptCode: string;
  issueDate: Date;
  observation: string;
  customer: ThirdPartyInvoiceCustomerInput;
  lines: ThirdPartyDocumentLineInput[];
  /** Total esperado con impuestos: se compara con el que calcula el proveedor. */
  total: number;
  /** Medio de pago DIAN de la devolucion o del cobro (10 efectivo, 47 transferencia...). */
  paymentMethodCode?: string;
}

export interface ThirdPartySupportDocumentInput {
  referenceCode: string;
  issueDate: Date;
  observation: string;
  provider: {
    documentType: string;
    documentNumber: string;
    name: string;
    address: string | null;
    email: string | null;
    phone: string | null;
    municipalityCode: string | null;
  };
  lines: ThirdPartyDocumentLineInput[];
  total: number;
  withholdings: ThirdPartyWithholdingInput[];
  /** Parte a credito (cuenta por pagar) y su vencimiento; sin ella, todo de contado. */
  creditAmount?: number;
  dueDate?: Date | null;
}

export interface ThirdPartyDocumentResult {
  status: "ACCEPTED" | "REJECTED";
  /** Numero legal asignado por el proveedor (vacio si REJECTED). */
  number: string;
  /** CUDE (notas) o CUDS (documento soporte) real. */
  uniqueCode: string;
  signedXmlContent: string;
  rejectionReason?: string;
  rawResponse: string;
}
