/** Datos de un pago de suscripcion recien confirmado, para avisarle al equipo de Contapro. */
export interface PaymentApprovedNotification {
  companyName: string;
  nit: string;
  companyEmail: string;
  planName: string;
  billingCycle: string;
  amount: number;
  newPeriodEnd: Date;
  /** true si la empresa todavia no factura con Factus: hay que pedirle los documentos y activarla. */
  invoicingPending: boolean;
}

/** Datos de la empresa y el plan de una suscripcion, para armar el aviso del pago. */
export interface PaymentNotificationInfo {
  companyName: string;
  nit: string;
  companyEmail: string;
  planName: string;
  billingCycle: string;
  electronicInvoicingProvider: string;
}

export interface IPaymentNotificationInfoReader {
  findPaymentNotificationInfo(subscriptionId: string): Promise<PaymentNotificationInfo | null>;
}

/**
 * Avisos internos para el equipo de Contapro (no para el cliente). Sin destinatario configurado
 * no hace nada: es una comodidad, nunca debe frenar la confirmacion de un pago.
 */
export interface IPlatformNotifier {
  paymentApproved(notification: PaymentApprovedNotification): Promise<void>;
}
