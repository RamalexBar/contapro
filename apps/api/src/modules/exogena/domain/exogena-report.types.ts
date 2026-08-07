/** Identificacion del tercero comun a todos los formatos exogena (item 37 de docs/ALCANCE.md).
 * `incompleto` = true cuando falta `municipalityCode` -- la fila se genera igual, solo se marca
 * para que el contador sepa qué terceros completar antes de un envio real. */
export interface ThirdPartyInfo {
  documentType: string;
  documentNumber: string;
  name: string;
  municipalityCode: string | null;
  incompleto: boolean;
}

export interface Format1001Row extends ThirdPartyInfo {
  supplierId: string;
  /** Codigo DIAN de concepto de pago -- generico fijo, ver README del modulo. */
  conceptoPago: string;
  valorPago: number;
  valorRetencionPracticada: number;
}

export interface Format1003Row extends ThirdPartyInfo {
  supplierId: string;
  /** Codigo DIAN de concepto de retencion (WithholdingConcept.dianConceptCode). Null = sin
   * asignar, ver `conceptoIncompleto`. */
  conceptoRetencion: string | null;
  conceptoIncompleto: boolean;
  valorBase: number;
  valorRetencion: number;
}

export interface Format1007Row extends ThirdPartyInfo {
  customerId: string;
  valorIngreso: number;
}

export interface Format1008Row extends ThirdPartyInfo {
  customerId: string;
  saldo: number;
}

export interface Format1009Row extends ThirdPartyInfo {
  supplierId: string;
  saldo: number;
}
