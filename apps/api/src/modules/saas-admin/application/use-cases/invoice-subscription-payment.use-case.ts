import type { IOperationalAlerts } from "../../../../shared/alerts/operational-alerts";
import type { AuditService } from "../../../audit/application/audit.service";
import type { ISubscriptionInvoiceIssuer, ISubscriptionInvoiceRepository, SubscriptionInvoiceBuyer } from "../../domain/subscription-invoicing";

export type SubscriptionInvoiceOutcome =
  | { status: "INVOICED"; manualInvoiceId: string; electronicStatus: string | null; electronicNumber: string | null }
  | { status: "NOT_CONFIGURED" }
  | { status: "SKIPPED"; reason: string }
  | { status: "FAILED"; error: string };

/**
 * Contapro le factura a su cliente cada pago de suscripcion confirmado (Wompi, cobro automatico o
 * pago registrado a mano en el panel). La factura sale de la empresa `issuerCompanyId`
 * (PLATFORM_INVOICING_COMPANY_ID): Contapro es un cliente mas de si mismo, con su resolucion DIAN y
 * Factus configurados como cualquier otra empresa. Persona natural no responsable de IVA: la linea
 * va sin IVA y el valor pagado es el total.
 *
 * Nunca lanza: el pago ya quedo aplicado y no se revierte por un problema de facturacion. Un fallo
 * queda guardado en el pago (invoiceError), auditado y avisado al equipo para reintentarlo desde el
 * panel de plataforma.
 */
export class InvoiceSubscriptionPaymentUseCase {
  constructor(
    private readonly repo: ISubscriptionInvoiceRepository,
    private readonly issuer: ISubscriptionInvoiceIssuer,
    private readonly issuerCompanyId: string,
    private readonly audit: AuditService,
    private readonly alerts?: IOperationalAlerts
  ) {}

  async execute(paymentId: string): Promise<SubscriptionInvoiceOutcome> {
    if (!this.issuerCompanyId) return { status: "NOT_CONFIGURED" };

    const data = await this.repo.findPaymentInvoiceData(paymentId);
    if (!data) return { status: "SKIPPED", reason: "El pago no existe" };
    if (data.status !== "CONFIRMED") return { status: "SKIPPED", reason: "El pago no está confirmado" };
    if (data.manualInvoiceId) return { status: "SKIPPED", reason: "El pago ya tiene factura" };
    if (data.billedBy === "CAJAPRO") return { status: "SKIPPED", reason: "El paquete lo factura Cajapro" };
    if (data.buyer.companyId === this.issuerCompanyId) return { status: "SKIPPED", reason: "Es la propia empresa de Contapro" };
    if (data.amount <= 0) return { status: "SKIPPED", reason: "Pago en cero" };
    if (!data.buyer.municipalityCode) {
      // Factus lo exige para un comprador con NIT; mejor un aviso claro que un rechazo de la DIAN.
      return this.fail(paymentId, data.buyer, "Falta el código DANE del municipio del cliente (Configuración → Datos de la empresa)");
    }

    const cycle = data.billingCycle === "YEARLY" ? "anual" : "mensual";
    const description = `Suscripción Contapro - ${data.planName} (${cycle}), vigente hasta el ${formatDate(data.coveredUntil)}`;

    try {
      const issued = await this.issuer.issue(this.issuerCompanyId, data.buyer, { description, amount: data.amount });
      await this.repo.markPaymentInvoiced(paymentId, issued.manualInvoiceId);
      await this.audit.recordWithoutContext(data.buyer.companyId, null, {
        action: "SUBSCRIPTION_PAYMENT_INVOICED",
        entityType: "SubscriptionPayment",
        entityId: paymentId,
        description: `Factura de la suscripción emitida (${issued.electronicNumber ?? "sin número DIAN"}, ${issued.electronicStatus ?? "sin estado"})`,
        metadata: { manualInvoiceId: issued.manualInvoiceId },
      });
      if (issued.electronicStatus !== "ACCEPTED") {
        this.alerts?.send(
          `subscription-invoice:${paymentId}`,
          "Factura de suscripción sin aceptar en la DIAN",
          `${data.buyer.name} (NIT ${data.buyer.documentNumber}): la factura quedó creada pero su estado es ${issued.electronicStatus ?? "sin generar"}. Revísela y reenvíela desde Facturación electrónica en la empresa de Contapro.`
        );
      }
      return { status: "INVOICED", ...issued };
    } catch (err) {
      return this.fail(paymentId, data.buyer, err instanceof Error ? err.message : String(err));
    }
  }

  private async fail(paymentId: string, buyer: SubscriptionInvoiceBuyer, error: string): Promise<SubscriptionInvoiceOutcome> {
    await this.repo.markPaymentInvoiceFailed(paymentId, error);
    await this.audit.recordWithoutContext(buyer.companyId, null, {
      action: "SUBSCRIPTION_PAYMENT_INVOICE_FAILED",
      entityType: "SubscriptionPayment",
      entityId: paymentId,
      description: `No se pudo facturar el pago de la suscripción: ${error}`,
    });
    this.alerts?.send(
      `subscription-invoice:${paymentId}`,
      "No se pudo facturar un pago de suscripción",
      `${buyer.name} (NIT ${buyer.documentNumber}), pago ${paymentId}: ${error}. Reintente desde el panel de plataforma → Suscripciones.`
    );
    return { status: "FAILED", error };
  }
}

function formatDate(date: Date): string {
  const d = date.toISOString().slice(0, 10).split("-");
  return `${d[2]}/${d[1]}/${d[0]}`;
}

/** Texto corto del resultado, para el aviso de pago al equipo y el panel. */
export function describeSubscriptionInvoice(outcome: SubscriptionInvoiceOutcome): string {
  switch (outcome.status) {
    case "INVOICED":
      return outcome.electronicStatus === "ACCEPTED"
        ? `emitida y aceptada por la DIAN (${outcome.electronicNumber}); Factus se la envió al correo del cliente.`
        : `creada, pero la factura electrónica quedó en estado ${outcome.electronicStatus ?? "sin generar"}: revísela en la empresa de Contapro.`;
    case "NOT_CONFIGURED":
      return "no se emitió: falta configurar PLATFORM_INVOICING_COMPANY_ID (la empresa de Contapro que factura).";
    case "SKIPPED":
      return `no aplica (${outcome.reason}).`;
    case "FAILED":
      return `falló: ${outcome.error}. Reintente desde el panel de plataforma.`;
  }
}
