/**
 * Factura de la suscripcion: Contapro, como empresa, le emite factura electronica a cada cliente por
 * cada pago confirmado (ver InvoiceSubscriptionPaymentUseCase).
 */

/** El comprador: la empresa que pago su suscripcion, con los datos fiscales que registro. */
export interface SubscriptionInvoiceBuyer {
  companyId: string;
  name: string;
  /** "NIT" o "CC" (Company.documentType); sin dato se asume NIT. */
  documentType: string;
  documentNumber: string;
  email: string;
  phone: string | null;
  address: string | null;
  municipalityCode: string | null;
  fiscalResponsibilities: string | null;
}

export interface SubscriptionPaymentInvoiceData {
  paymentId: string;
  status: string;
  amount: number;
  /** Ya facturado: no se vuelve a facturar (el webhook de Wompi puede repetirse). */
  manualInvoiceId: string | null;
  /** "CAJAPRO" = el paquete lo cobra y factura el aliado, no Contapro. */
  billedBy: string | null;
  planName: string;
  billingCycle: string;
  /** Vencimiento de la suscripcion despues de este pago (hasta donde cubre lo facturado). */
  coveredUntil: Date;
  buyer: SubscriptionInvoiceBuyer;
}

export interface ISubscriptionInvoiceRepository {
  findPaymentInvoiceData(paymentId: string): Promise<SubscriptionPaymentInvoiceData | null>;
  markPaymentInvoiced(paymentId: string, manualInvoiceId: string): Promise<void>;
  markPaymentInvoiceFailed(paymentId: string, error: string): Promise<void>;
}

export interface SubscriptionInvoiceLine {
  description: string;
  amount: number;
}

export interface IssuedSubscriptionInvoice {
  manualInvoiceId: string;
  /** Estado de la factura electronica (ACCEPTED, REJECTED, ...); null si no se llego a generar. */
  electronicStatus: string | null;
  electronicNumber: string | null;
}

/** Emite la factura desde la empresa de Contapro (infraestructura: entra al tenant de esa empresa). */
export interface ISubscriptionInvoiceIssuer {
  issue(issuerCompanyId: string, buyer: SubscriptionInvoiceBuyer, line: SubscriptionInvoiceLine): Promise<IssuedSubscriptionInvoice>;
}
