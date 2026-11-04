import type { NextFunction, Request, Response } from "express";
import type { InvoiceSubscriptionPaymentUseCase } from "../application/use-cases/invoice-subscription-payment.use-case";
import { describeSubscriptionInvoice } from "../application/use-cases/invoice-subscription-payment.use-case";

/** Panel de plataforma: reintentar la factura de un pago de suscripcion que no se pudo facturar. */
export class SubscriptionInvoiceController {
  constructor(private readonly invoicePayment: InvoiceSubscriptionPaymentUseCase) {}

  retry = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const outcome = await this.invoicePayment.execute(req.params.paymentId);
      res.json({ ...outcome, message: describeSubscriptionInvoice(outcome) });
    } catch (err) {
      next(err);
    }
  };
}
