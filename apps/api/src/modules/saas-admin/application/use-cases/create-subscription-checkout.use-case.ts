import crypto from "node:crypto";
import { ValidationError } from "../../../../shared/errors/app-error";
import type { IPlanRepository } from "../../domain/plan.repository";
import type { IPaymentGateway } from "../../domain/payment-gateway";
import type { ISubscriptionRepository } from "../../domain/subscription.repository";

export interface CreateSubscriptionCheckoutInput {
  subscriptionId: string;
  customerEmail: string;
  redirectUrl?: string;
}

export interface CreateSubscriptionCheckoutResult {
  checkoutUrl: string;
  reference: string;
  amount: number;
}

/**
 * Genera el link de pago Wompi para renovar una suscripcion. Monto = precio del plan segun
 * billingCycle (mensual/anual) -- no se le pide el monto a quien llama, se deriva del plan para
 * que no se pueda manipular desde el cliente. `reference` es unico por INTENTO de cobro, no por
 * suscripcion (permite reintentar tras un DECLINED sin chocar con nada); se crea un
 * SubscriptionPayment PENDING que ConfirmWompiPaymentUseCase confirma o marca fallido cuando
 * Wompi responde por webhook.
 */
export class CreateSubscriptionCheckoutUseCase {
  constructor(
    private readonly subscriptionRepo: ISubscriptionRepository,
    private readonly planRepo: IPlanRepository,
    private readonly paymentGateway: IPaymentGateway
  ) {}

  async execute(input: CreateSubscriptionCheckoutInput): Promise<CreateSubscriptionCheckoutResult> {
    const subscription = await this.subscriptionRepo.findByIdOrThrow(input.subscriptionId);
    const plan = await this.planRepo.findByIdOrThrow(subscription.planId);

    const amount = subscription.billingCycle === "YEARLY" ? plan.priceYearly : plan.priceMonthly;
    if (amount <= 0) {
      throw new ValidationError("Este plan no tiene costo, no requiere generar un cobro");
    }

    // randomUUID (no solo Date.now()): dos intentos de cobro para la misma suscripcion podrian
    // caer en el mismo milisegundo, Date.now() solo no garantiza unicidad.
    const reference = `sub-${subscription.id}-${Date.now()}-${crypto.randomUUID().slice(0, 8)}`;
    await this.subscriptionRepo.createPendingPayment({
      subscriptionId: subscription.id,
      amount,
      method: "WOMPI",
      reference,
    });

    const { checkoutUrl } = this.paymentGateway.buildCheckoutUrl({
      reference,
      amountInCents: Math.round(amount * 100),
      customerEmail: input.customerEmail,
      redirectUrl: input.redirectUrl,
    });

    return { checkoutUrl, reference, amount };
  }
}
