import crypto from "node:crypto";
import { ValidationError } from "../../../../shared/errors/app-error";
import type { IPaymentGateway } from "../../../saas-admin/domain/payment-gateway";
import type { IAccountReceivableRepository } from "../../domain/account-receivable.repository";
import type { ICustomerRepository } from "../../../customers/domain/customer.repository";
import type { AuditService } from "../../../audit/application/audit.service";

export interface CreateReceivableCheckoutInput {
  accountReceivableId: string;
  redirectUrl?: string;
}

export interface CreateReceivableCheckoutResult {
  checkoutUrl: string;
  reference: string;
  amount: number;
}

/**
 * Genera el link de pago Wompi para que EL CLIENTE de la empresa pague una cuenta por cobrar
 * (item 31) -- analogo a CreateSubscriptionCheckoutUseCase (saas-admin), pero llama a
 * IPaymentGateway.buildCheckoutUrl directo en vez de reusar ese caso de uso: el port ya es
 * generico (reference/amountInCents/customerEmail), no hace falta forzar una capa de
 * indireccion atada a Subscription/Plan que no aplica aqui. `reference` es unica por INTENTO de
 * cobro (permite reintentar sin chocar con nada, mismo motivo alli).
 */
export class CreateReceivableCheckoutUseCase {
  constructor(
    private readonly accountReceivableRepo: IAccountReceivableRepository,
    private readonly customerRepo: ICustomerRepository,
    private readonly paymentGateway: IPaymentGateway,
    private readonly audit: AuditService
  ) {}

  async execute(input: CreateReceivableCheckoutInput): Promise<CreateReceivableCheckoutResult> {
    const receivable = await this.accountReceivableRepo.findByIdOrThrow(input.accountReceivableId);
    if (receivable.balance <= 0) {
      throw new ValidationError("Esta cuenta por cobrar ya esta saldada");
    }
    const customer = await this.customerRepo.findByIdOrThrow(receivable.customerId);
    if (!customer.email) {
      throw new ValidationError(`El cliente ${customer.name} no tiene email registrado -- no se puede generar un link de pago (si se puede registrar un abono en persona)`);
    }

    const reference = `ar-${receivable.id}-${Date.now()}-${crypto.randomUUID().slice(0, 8)}`;
    await this.accountReceivableRepo.createPendingCheckoutPayment(receivable.id, receivable.balance, reference);

    const { checkoutUrl } = this.paymentGateway.buildCheckoutUrl({
      reference,
      amountInCents: Math.round(receivable.balance * 100),
      customerEmail: customer.email,
      redirectUrl: input.redirectUrl,
    });

    await this.audit.record({
      action: "RECEIVABLE_CHECKOUT_CREATED",
      entityType: "AccountReceivable",
      entityId: receivable.id,
      description: `Link de pago generado para ${customer.name} por ${receivable.balance}`,
      metadata: { reference },
    });

    return { checkoutUrl, reference, amount: receivable.balance };
  }
}
