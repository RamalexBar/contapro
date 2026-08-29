import type { NextFunction, Request, Response } from "express";
import { basePrisma } from "@erp/database";
import { formatCOP } from "@erp/shared-utils";
import { getTenantContext } from "../../../shared/context/request-context";
import { NotFoundError } from "../../../shared/errors/app-error";
import { renderSimpleDocumentPdf } from "../../../shared/pdf/simple-document-renderer";
import { wompiWebhookSchema } from "../../saas-admin/interfaces/saas-admin.validators";
import type { ListAccountsReceivableUseCase } from "../application/use-cases/list-accounts-receivable.use-case";
import type { RegisterReceivablePaymentUseCase } from "../application/use-cases/register-receivable-payment.use-case";
import type { CreateReceivableCheckoutUseCase } from "../application/use-cases/create-receivable-checkout.use-case";
import type { ConfirmReceivableWompiPaymentUseCase } from "../application/use-cases/confirm-receivable-wompi-payment.use-case";
import type { IAccountReceivableRepository } from "../domain/account-receivable.repository";
import type { ICustomerRepository } from "../../customers/domain/customer.repository";
import { createReceivableCheckoutSchema, registerReceivablePaymentSchema } from "./collections.validators";

export class CollectionsController {
  constructor(
    private readonly listAccountsReceivableUseCase: ListAccountsReceivableUseCase,
    private readonly registerReceivablePaymentUseCase: RegisterReceivablePaymentUseCase,
    private readonly createReceivableCheckoutUseCase: CreateReceivableCheckoutUseCase,
    private readonly confirmReceivableWompiPaymentUseCase: ConfirmReceivableWompiPaymentUseCase,
    private readonly accountReceivableRepo: IAccountReceivableRepository,
    private readonly customerRepo: ICustomerRepository
  ) {}

  listAccountsReceivable = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const status = typeof req.query.status === "string" ? req.query.status : undefined;
      res.json({ data: await this.listAccountsReceivableUseCase.execute({ status }) });
    } catch (err) {
      next(err);
    }
  };

  registerPayment = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const body = registerReceivablePaymentSchema.parse(req.body);
      res.status(201).json(await this.registerReceivablePaymentUseCase.execute({ accountReceivableId: req.params.id, ...body }));
    } catch (err) {
      next(err);
    }
  };

  createCheckout = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const body = createReceivableCheckoutSchema.parse(req.body);
      res.status(201).json(await this.createReceivableCheckoutUseCase.execute({ accountReceivableId: req.params.id, ...body }));
    } catch (err) {
      next(err);
    }
  };

  getPaymentPdf = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const payment = await this.accountReceivableRepo.findPaymentByIdOrThrow(req.params.id);
      const receivable = await this.accountReceivableRepo.findByIdOrThrow(payment.accountReceivableId);
      const [company, customer] = await Promise.all([
        basePrisma.company.findFirst({ where: { id: getTenantContext().companyId } }),
        this.customerRepo.findByIdOrThrow(receivable.customerId),
      ]);
      if (!company) throw new NotFoundError("Company", getTenantContext().companyId);

      const pdf = await renderSimpleDocumentPdf({
        company: { name: company.name, nit: company.nit },
        title: "Recibo de cobro a cliente",
        fields: [
          { label: "Cliente", value: customer.name },
          { label: "Fecha de pago", value: payment.paidAt.toISOString().slice(0, 10) },
          { label: "Medio de pago", value: payment.method },
          { label: "Estado", value: payment.status === "REGISTERED" ? "Registrado" : payment.status },
        ],
        totalLabel: "Monto cobrado",
        total: formatCOP(payment.amount),
        generatedAt: new Date(),
      });
      res.type("application/pdf").send(pdf);
    } catch (err) {
      next(err);
    }
  };

  // Publica a proposito -- la llama Wompi, no un usuario autenticado (mismo criterio que
  // saasAdminController.wompiWebhook).
  wompiWebhook = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const event = wompiWebhookSchema.parse(req.body);
      await this.confirmReceivableWompiPaymentUseCase.execute(event);
      res.status(200).json({ received: true });
    } catch (err) {
      next(err);
    }
  };
}
