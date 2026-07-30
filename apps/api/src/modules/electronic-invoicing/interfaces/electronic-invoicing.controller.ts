import type { NextFunction, Request, Response } from "express";
import type { CreateNumberingResolutionUseCase } from "../application/use-cases/create-numbering-resolution.use-case";
import type { ListNumberingResolutionsUseCase } from "../application/use-cases/list-numbering-resolutions.use-case";
import type { GetElectronicInvoiceUseCase } from "../application/use-cases/get-electronic-invoice.use-case";
import { createNumberingResolutionSchema } from "./electronic-invoicing.validators";

export class ElectronicInvoicingController {
  constructor(
    private readonly createResolutionUseCase: CreateNumberingResolutionUseCase,
    private readonly listResolutionsUseCase: ListNumberingResolutionsUseCase,
    private readonly getInvoiceUseCase: GetElectronicInvoiceUseCase
  ) {}

  createResolution = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const body = createNumberingResolutionSchema.parse(req.body);
      res.status(201).json(await this.createResolutionUseCase.execute(body));
    } catch (err) {
      next(err);
    }
  };

  listResolutions = async (_req: Request, res: Response, next: NextFunction) => {
    try {
      res.json({ data: await this.listResolutionsUseCase.execute() });
    } catch (err) {
      next(err);
    }
  };

  getBySale = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const invoice = await this.getInvoiceUseCase.execute(req.params.saleId);
      const { xmlContent: _xmlContent, ...metadata } = invoice;
      res.json(metadata);
    } catch (err) {
      next(err);
    }
  };

  getXmlBySale = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const invoice = await this.getInvoiceUseCase.execute(req.params.saleId);
      res.type("application/xml").send(invoice.xmlContent);
    } catch (err) {
      next(err);
    }
  };
}
