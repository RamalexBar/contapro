import type { NextFunction, Request, Response } from "express";
import type { CreateSupplierUseCase } from "../application/use-cases/create-supplier.use-case";
import type { ListSuppliersUseCase } from "../application/use-cases/list-suppliers.use-case";
import type { CreatePurchaseUseCase } from "../application/use-cases/create-purchase.use-case";
import type { ListPurchasesUseCase } from "../application/use-cases/list-purchases.use-case";
import type { CreatePurchaseOrderUseCase } from "../application/use-cases/create-purchase-order.use-case";
import type { SendPurchaseOrderUseCase } from "../application/use-cases/send-purchase-order.use-case";
import type { ListPurchaseOrdersUseCase } from "../application/use-cases/list-purchase-orders.use-case";
import type { GetPurchaseOrderUseCase } from "../application/use-cases/get-purchase-order.use-case";
import type { ReceiveGoodsUseCase } from "../application/use-cases/receive-goods.use-case";
import type { ListGoodsReceiptsUseCase } from "../application/use-cases/list-goods-receipts.use-case";
import type { GetGoodsReceiptUseCase } from "../application/use-cases/get-goods-receipt.use-case";
import type { ListAccountsPayableUseCase } from "../application/use-cases/list-accounts-payable.use-case";
import type { RegisterSupplierPaymentUseCase } from "../application/use-cases/register-supplier-payment.use-case";
import type { CancelPurchaseUseCase } from "../application/use-cases/cancel-purchase.use-case";
import type { ExtractPurchaseInvoiceUseCase } from "../application/use-cases/extract-purchase-invoice.use-case";
import type { ISupplierRepository } from "../domain/supplier.repository";
import type { IAccountPayableRepository } from "../domain/account-payable.repository";
import { basePrisma } from "@erp/database";
import { prisma } from "../../../shared/prisma/prisma-client";
import { formatCOP } from "@erp/shared-utils";
import { getTenantContext } from "../../../shared/context/request-context";
import { NotFoundError } from "../../../shared/errors/app-error";
import { renderSimpleDocumentPdf } from "../../../shared/pdf/simple-document-renderer";
import {
  createPurchaseOrderSchema,
  createPurchaseSchema,
  createSupplierSchema,
  extractPurchaseInvoiceSchema,
  receiveGoodsSchema,
  registerSupplierPaymentSchema,
} from "./suppliers.validators";

export class SuppliersController {
  constructor(
    private readonly createSupplierUseCase: CreateSupplierUseCase,
    private readonly listSuppliersUseCase: ListSuppliersUseCase,
    private readonly createPurchaseUseCase: CreatePurchaseUseCase,
    private readonly listPurchasesUseCase: ListPurchasesUseCase,
    private readonly createPurchaseOrderUseCase: CreatePurchaseOrderUseCase,
    private readonly sendPurchaseOrderUseCase: SendPurchaseOrderUseCase,
    private readonly listPurchaseOrdersUseCase: ListPurchaseOrdersUseCase,
    private readonly getPurchaseOrderUseCase: GetPurchaseOrderUseCase,
    private readonly receiveGoodsUseCase: ReceiveGoodsUseCase,
    private readonly listGoodsReceiptsUseCase: ListGoodsReceiptsUseCase,
    private readonly getGoodsReceiptUseCase: GetGoodsReceiptUseCase,
    private readonly listAccountsPayableUseCase: ListAccountsPayableUseCase,
    private readonly registerSupplierPaymentUseCase: RegisterSupplierPaymentUseCase,
    private readonly cancelPurchaseUseCase: CancelPurchaseUseCase,
    private readonly extractPurchaseInvoiceUseCase: ExtractPurchaseInvoiceUseCase,
    private readonly supplierRepo: ISupplierRepository,
    private readonly accountPayableRepo: IAccountPayableRepository
  ) {}

  private async getCompanyOrThrow() {
    const company = await basePrisma.company.findFirst({ where: { id: getTenantContext().companyId } });
    if (!company) throw new NotFoundError("Company", getTenantContext().companyId);
    return company;
  }

  createSupplier = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const body = createSupplierSchema.parse(req.body);
      res.status(201).json(await this.createSupplierUseCase.execute(body));
    } catch (err) {
      next(err);
    }
  };

  listSuppliers = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const search = typeof req.query.search === "string" ? req.query.search : undefined;
      res.json({ data: await this.listSuppliersUseCase.execute(search) });
    } catch (err) {
      next(err);
    }
  };

  createPurchase = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const body = createPurchaseSchema.parse(req.body);
      res.status(201).json(await this.createPurchaseUseCase.execute(body));
    } catch (err) {
      next(err);
    }
  };

  extractPurchaseInvoice = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const body = extractPurchaseInvoiceSchema.parse(req.body);
      res.json(await this.extractPurchaseInvoiceUseCase.execute({ base64: body.fileBase64, mediaType: body.mediaType }));
    } catch (err) {
      next(err);
    }
  };

  listPurchases = async (_req: Request, res: Response, next: NextFunction) => {
    try {
      res.json({ data: await this.listPurchasesUseCase.execute() });
    } catch (err) {
      next(err);
    }
  };

  cancelPurchase = async (req: Request, res: Response, next: NextFunction) => {
    try {
      res.json(await this.cancelPurchaseUseCase.execute(req.params.id));
    } catch (err) {
      next(err);
    }
  };

  createPurchaseOrder = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const body = createPurchaseOrderSchema.parse(req.body);
      res.status(201).json(await this.createPurchaseOrderUseCase.execute(body));
    } catch (err) {
      next(err);
    }
  };

  listPurchaseOrders = async (_req: Request, res: Response, next: NextFunction) => {
    try {
      res.json({ data: await this.listPurchaseOrdersUseCase.execute() });
    } catch (err) {
      next(err);
    }
  };

  getPurchaseOrder = async (req: Request, res: Response, next: NextFunction) => {
    try {
      res.json(await this.getPurchaseOrderUseCase.execute(req.params.id));
    } catch (err) {
      next(err);
    }
  };

  sendPurchaseOrder = async (req: Request, res: Response, next: NextFunction) => {
    try {
      res.json(await this.sendPurchaseOrderUseCase.execute(req.params.id));
    } catch (err) {
      next(err);
    }
  };

  receiveGoods = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const body = receiveGoodsSchema.parse(req.body);
      res.status(201).json(await this.receiveGoodsUseCase.execute(body));
    } catch (err) {
      next(err);
    }
  };

  listGoodsReceipts = async (_req: Request, res: Response, next: NextFunction) => {
    try {
      res.json({ data: await this.listGoodsReceiptsUseCase.execute() });
    } catch (err) {
      next(err);
    }
  };

  getGoodsReceipt = async (req: Request, res: Response, next: NextFunction) => {
    try {
      res.json(await this.getGoodsReceiptUseCase.execute(req.params.id));
    } catch (err) {
      next(err);
    }
  };

  listAccountsPayable = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const status = typeof req.query.status === "string" ? req.query.status : undefined;
      res.json({ data: await this.listAccountsPayableUseCase.execute(status) });
    } catch (err) {
      next(err);
    }
  };

  registerSupplierPayment = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const body = registerSupplierPaymentSchema.parse(req.body);
      res.status(201).json(await this.registerSupplierPaymentUseCase.execute({ accountPayableId: req.params.id, ...body }));
    } catch (err) {
      next(err);
    }
  };

  getPurchaseOrderPdf = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const po = await this.getPurchaseOrderUseCase.execute(req.params.id);
      const [company, supplier, products] = await Promise.all([
        this.getCompanyOrThrow(),
        this.supplierRepo.findByIdOrThrow(po.supplierId),
        prisma.product.findMany({ where: { id: { in: po.items.map((i) => i.productId) } }, select: { id: true, name: true } }),
      ]);
      const productName = (id: string) => products.find((p) => p.id === id)?.name ?? "(producto no encontrado)";

      const pdf = await renderSimpleDocumentPdf({
        company: { name: company.name, nit: company.nit },
        title: "Orden de compra",
        fields: [
          { label: "Proveedor", value: supplier.name },
          { label: "Fecha", value: po.createdAt.toISOString().slice(0, 10) },
          ...(po.expectedDate ? [{ label: "Fecha esperada", value: po.expectedDate.toISOString().slice(0, 10) }] : []),
        ],
        items: po.items.map((item) => ({
          description: productName(item.productId),
          quantity: String(item.quantity),
          unitPrice: formatCOP(item.unitCost),
          amount: formatCOP(item.total),
        })),
        totalLabel: "Total",
        total: formatCOP(po.total),
        generatedAt: new Date(),
      });
      res.type("application/pdf").send(pdf);
    } catch (err) {
      next(err);
    }
  };

  getSupplierPaymentPdf = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const payment = await this.accountPayableRepo.findPaymentByIdOrThrow(req.params.id);
      const accountPayable = await this.accountPayableRepo.findByIdOrThrow(payment.accountPayableId);
      const [company, supplier] = await Promise.all([this.getCompanyOrThrow(), this.supplierRepo.findByIdOrThrow(accountPayable.supplierId)]);

      const pdf = await renderSimpleDocumentPdf({
        company: { name: company.name, nit: company.nit },
        title: "Recibo de pago a proveedor",
        fields: [
          { label: "Proveedor", value: supplier.name },
          { label: "Fecha de pago", value: payment.paidAt.toISOString().slice(0, 10) },
          { label: "Medio de pago", value: payment.method },
          { label: "Estado", value: payment.status === "REVERSED" ? "Reversado" : "Registrado" },
        ],
        totalLabel: "Monto pagado",
        total: formatCOP(payment.amount),
        generatedAt: new Date(),
      });
      res.type("application/pdf").send(pdf);
    } catch (err) {
      next(err);
    }
  };
}
