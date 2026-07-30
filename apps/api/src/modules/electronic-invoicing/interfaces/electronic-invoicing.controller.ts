import type { NextFunction, Request, Response } from "express";
import type { CreateNumberingResolutionUseCase } from "../application/use-cases/create-numbering-resolution.use-case";
import type { ListNumberingResolutionsUseCase } from "../application/use-cases/list-numbering-resolutions.use-case";
import type { GetElectronicInvoiceUseCase } from "../application/use-cases/get-electronic-invoice.use-case";
import type { ResubmitElectronicInvoiceUseCase } from "../application/use-cases/resubmit-electronic-invoice.use-case";
import type { GetElectronicCreditNoteUseCase } from "../application/use-cases/get-electronic-credit-note.use-case";
import type { ResubmitElectronicCreditNoteUseCase } from "../application/use-cases/resubmit-electronic-credit-note.use-case";
import type { GetElectronicDebitNoteUseCase } from "../application/use-cases/get-electronic-debit-note.use-case";
import type { ResubmitElectronicDebitNoteUseCase } from "../application/use-cases/resubmit-electronic-debit-note.use-case";
import type { GetElectronicSupportDocumentUseCase } from "../application/use-cases/get-electronic-support-document.use-case";
import type { ResubmitElectronicSupportDocumentUseCase } from "../application/use-cases/resubmit-electronic-support-document.use-case";
import type { GetElectronicPayrollUseCase } from "../application/use-cases/get-electronic-payroll.use-case";
import type { ResubmitElectronicPayrollUseCase } from "../application/use-cases/resubmit-electronic-payroll.use-case";
import { createNumberingResolutionSchema } from "./electronic-invoicing.validators";

export class ElectronicInvoicingController {
  constructor(
    private readonly createResolutionUseCase: CreateNumberingResolutionUseCase,
    private readonly listResolutionsUseCase: ListNumberingResolutionsUseCase,
    private readonly getInvoiceUseCase: GetElectronicInvoiceUseCase,
    private readonly resubmitUseCase: ResubmitElectronicInvoiceUseCase,
    private readonly getCreditNoteUseCase: GetElectronicCreditNoteUseCase,
    private readonly resubmitCreditNoteUseCase: ResubmitElectronicCreditNoteUseCase,
    private readonly getDebitNoteUseCase: GetElectronicDebitNoteUseCase,
    private readonly resubmitDebitNoteUseCase: ResubmitElectronicDebitNoteUseCase,
    private readonly getSupportDocumentUseCase: GetElectronicSupportDocumentUseCase,
    private readonly resubmitSupportDocumentUseCase: ResubmitElectronicSupportDocumentUseCase,
    private readonly getPayrollUseCase: GetElectronicPayrollUseCase,
    private readonly resubmitPayrollUseCase: ResubmitElectronicPayrollUseCase
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
      const { xmlContent: _xmlContent, signedXmlContent: _signedXmlContent, ...metadata } = invoice;
      res.json(metadata);
    } catch (err) {
      next(err);
    }
  };

  getXmlBySale = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const invoice = await this.getInvoiceUseCase.execute(req.params.saleId);
      res.type("application/xml").send(invoice.signedXmlContent ?? invoice.xmlContent);
    } catch (err) {
      next(err);
    }
  };

  resubmit = async (req: Request, res: Response, next: NextFunction) => {
    try {
      await this.resubmitUseCase.execute(req.params.saleId);
      res.status(204).send();
    } catch (err) {
      next(err);
    }
  };

  getByCreditNote = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const note = await this.getCreditNoteUseCase.execute(req.params.creditNoteId);
      const { xmlContent: _xmlContent, signedXmlContent: _signedXmlContent, ...metadata } = note;
      res.json(metadata);
    } catch (err) {
      next(err);
    }
  };

  getXmlByCreditNote = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const note = await this.getCreditNoteUseCase.execute(req.params.creditNoteId);
      res.type("application/xml").send(note.signedXmlContent ?? note.xmlContent);
    } catch (err) {
      next(err);
    }
  };

  resubmitCreditNote = async (req: Request, res: Response, next: NextFunction) => {
    try {
      await this.resubmitCreditNoteUseCase.execute(req.params.creditNoteId);
      res.status(204).send();
    } catch (err) {
      next(err);
    }
  };

  getByDebitNote = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const note = await this.getDebitNoteUseCase.execute(req.params.debitNoteId);
      const { xmlContent: _xmlContent, signedXmlContent: _signedXmlContent, ...metadata } = note;
      res.json(metadata);
    } catch (err) {
      next(err);
    }
  };

  getXmlByDebitNote = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const note = await this.getDebitNoteUseCase.execute(req.params.debitNoteId);
      res.type("application/xml").send(note.signedXmlContent ?? note.xmlContent);
    } catch (err) {
      next(err);
    }
  };

  resubmitDebitNote = async (req: Request, res: Response, next: NextFunction) => {
    try {
      await this.resubmitDebitNoteUseCase.execute(req.params.debitNoteId);
      res.status(204).send();
    } catch (err) {
      next(err);
    }
  };

  getBySupportDocument = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const doc = await this.getSupportDocumentUseCase.execute(req.params.purchaseId);
      const { xmlContent: _xmlContent, signedXmlContent: _signedXmlContent, ...metadata } = doc;
      res.json(metadata);
    } catch (err) {
      next(err);
    }
  };

  getXmlBySupportDocument = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const doc = await this.getSupportDocumentUseCase.execute(req.params.purchaseId);
      res.type("application/xml").send(doc.signedXmlContent ?? doc.xmlContent);
    } catch (err) {
      next(err);
    }
  };

  resubmitSupportDocument = async (req: Request, res: Response, next: NextFunction) => {
    try {
      await this.resubmitSupportDocumentUseCase.execute(req.params.purchaseId);
      res.status(204).send();
    } catch (err) {
      next(err);
    }
  };

  getByPayrollDetail = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const doc = await this.getPayrollUseCase.execute(req.params.payrollDetailId);
      const { xmlContent: _xmlContent, signedXmlContent: _signedXmlContent, ...metadata } = doc;
      res.json(metadata);
    } catch (err) {
      next(err);
    }
  };

  getXmlByPayrollDetail = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const doc = await this.getPayrollUseCase.execute(req.params.payrollDetailId);
      res.type("application/xml").send(doc.signedXmlContent ?? doc.xmlContent);
    } catch (err) {
      next(err);
    }
  };

  resubmitPayrollDetail = async (req: Request, res: Response, next: NextFunction) => {
    try {
      await this.resubmitPayrollUseCase.execute(req.params.payrollDetailId);
      res.status(204).send();
    } catch (err) {
      next(err);
    }
  };
}
