import type { NextFunction, Request, Response } from "express";
import { createQuoteSchema } from "@erp/shared-types";
import { basePrisma } from "@erp/database";
import { formatCOP } from "@erp/shared-utils";
import { getTenantContext } from "../../../../shared/context/request-context";
import { NotFoundError } from "../../../../shared/errors/app-error";
import { renderSimpleDocumentPdf } from "../../../../shared/pdf/simple-document-renderer";
import type { CreateQuoteUseCase } from "../application/use-cases/create-quote.use-case";
import type { ListQuotesUseCase } from "../application/use-cases/list-quotes.use-case";
import type { IQuoteRepository } from "../domain/quote.repository";

export class QuoteController {
  constructor(
    private readonly createUseCase: CreateQuoteUseCase,
    private readonly listUseCase: ListQuotesUseCase,
    private readonly quoteRepo: IQuoteRepository
  ) {}

  create = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const body = createQuoteSchema.parse(req.body);
      res.status(201).json(await this.createUseCase.execute(body));
    } catch (err) {
      next(err);
    }
  };

  list = async (_req: Request, res: Response, next: NextFunction) => {
    try {
      res.json({ data: await this.listUseCase.execute() });
    } catch (err) {
      next(err);
    }
  };

  getPdf = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const quote = await this.quoteRepo.findByIdOrThrow(req.params.id);
      const company = await basePrisma.company.findFirst({ where: { id: getTenantContext().companyId } });
      if (!company) throw new NotFoundError("Company", getTenantContext().companyId);

      const pdf = await renderSimpleDocumentPdf({
        company: { name: company.name, nit: company.nit },
        title: "Cotizacion",
        fields: [
          { label: "Cliente", value: quote.customerName ?? "Consumidor final" },
          { label: "Fecha", value: quote.createdAt.toISOString().slice(0, 10) },
          { label: "Valida hasta", value: quote.validUntil.toISOString().slice(0, 10) },
        ],
        items: quote.items.map((item) => ({
          description: item.productName,
          quantity: String(item.quantity),
          unitPrice: formatCOP(item.unitPrice),
          amount: formatCOP(item.total),
        })),
        totalLabel: "Total",
        total: formatCOP(quote.total),
        footerNote: "Cotizacion sujeta a disponibilidad de inventario al momento de la venta.",
        generatedAt: new Date(),
      });
      res.type("application/pdf").send(pdf);
    } catch (err) {
      next(err);
    }
  };
}
