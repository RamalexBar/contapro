export interface DianSubmissionResult {
  trackingId: string;
}

export type DianDocumentStatus = "PENDING" | "ACCEPTED" | "REJECTED";

export interface DianStatusResult {
  status: DianDocumentStatus;
  responseXml?: string;
  rejectionReason?: string;
}

/**
 * BEST-DOCUMENTED-UNDERSTANDING, NO VERIFICADO contra el WSDL/Anexo Tecnico vigente de la DIAN.
 * Modelado sobre el patron asincrono documentado de la DIAN para emisores de alto volumen
 * (enviar el XML firmado y recibir un identificador de seguimiento; consultar el estado por
 * separado) en vez del envio sincrono, mas apropiado para un sistema POS que factura muchas
 * veces al dia. Confirmar nombres de operacion, URL del servicio y forma exacta de autenticacion
 * contra el Anexo Tecnico + WSDL actuales antes de usar esto contra la DIAN real -- ver el
 * comentario de cabecera en infrastructure/dian-soap-client.ts para el mismo aviso en el punto
 * donde realmente se construye el sobre SOAP.
 */
export interface IDianClient {
  sendBillAsync(signedXml: string): Promise<DianSubmissionResult>;
  getStatus(trackingId: string): Promise<DianStatusResult>;
}
