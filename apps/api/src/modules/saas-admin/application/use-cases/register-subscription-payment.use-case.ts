import { calculateNextPeriodEnd } from "@erp/shared-utils";
import type { AuditService } from "../../../audit/application/audit.service";
import type { ApplyPaymentResult, ISubscriptionRepository } from "../../domain/subscription.repository";
import type { InvoiceSubscriptionPaymentUseCase, SubscriptionInvoiceOutcome } from "./invoice-subscription-payment.use-case";

export interface RegisterSubscriptionPaymentInput {
  subscriptionId: string;
  amount: number;
  method: string;
  reference?: string;
  platformAdminId: string;
}

/**
 * Aplica un pago/renovacion: el nuevo vencimiento se calcula desde currentPeriodEnd ORIGINAL
 * (calculateNextPeriodEnd, packages/shared-utils/src/dates.ts) -- nunca desde la fecha del pago,
 * para que el cliente no gane dias por pagar tarde dentro del periodo de gracia.
 */
export class RegisterSubscriptionPaymentUseCase {
  constructor(
    private readonly repo: ISubscriptionRepository,
    private readonly audit: AuditService,
    private readonly invoicePayment?: Pick<InvoiceSubscriptionPaymentUseCase, "execute">
  ) {}

  async execute(input: RegisterSubscriptionPaymentInput): Promise<ApplyPaymentResult & { invoice: SubscriptionInvoiceOutcome | null }> {
    const subscription = await this.repo.findByIdOrThrow(input.subscriptionId);
    const cycleMonths = subscription.billingCycle === "YEARLY" ? 12 : 1;
    const newPeriodEnd = calculateNextPeriodEnd(subscription.currentPeriodEnd, cycleMonths);

    const result = await this.repo.applyPayment(input.subscriptionId, {
      amount: input.amount,
      method: input.method,
      reference: input.reference,
      newPeriodEnd,
    });

    await this.audit.recordWithoutContext(subscription.companyId, input.platformAdminId, {
      action: "SUBSCRIPTION_PAYMENT_REGISTERED",
      entityType: "Subscription",
      entityId: input.subscriptionId,
      description: `Pago de suscripcion registrado: ${input.amount} (${input.method}). Nuevo vencimiento: ${newPeriodEnd.toISOString().slice(0, 10)}`,
    });

    // La factura al cliente: nunca lanza, el pago ya quedo aplicado.
    const invoice = this.invoicePayment ? await this.invoicePayment.execute(result.payment.id) : null;
    return { ...result, invoice };
  }
}
