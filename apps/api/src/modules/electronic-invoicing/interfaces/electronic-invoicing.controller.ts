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
import type { SetElectronicInvoicingProviderUseCase } from "../application/use-cases/set-electronic-invoicing-provider.use-case";
import type { GetElectronicInvoicingProviderSettingsUseCase } from "../application/use-cases/get-electronic-invoicing-provider-settings.use-case";
import { mapInvoiceToRideData, mapNoteToRideData, mapPayrollToRideData, mapSupportDocumentToRideData } from "../application/ride-data-mapper";
import { renderRidePdf, renderThermalReceiptPdf } from "../infrastructure/pdfkit-ride-renderer";
import type { RideDocumentData } from "../application/ride-data-mapper";
import type { SendInvoiceWhatsAppUseCase } from "../application/use-cases/send-invoice-whatsapp.use-case";
import type { ISaleRepository } from "../../pos/sale/domain/sale.repository";
import type { IWhatsAppDeliveryLogRepository } from "../../whatsapp/domain/whatsapp-delivery-log.repository";
import { getTenantContext } from "../../../shared/context/request-context";
import { createNumberingResolutionSchema, setElectronicInvoicingProviderSchema } from "./electronic-invoicing.validators";

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
    private readonly resubmitPayrollUseCase: ResubmitElectronicPayrollUseCase,
    private readonly sendInvoiceWhatsAppUseCase: SendInvoiceWhatsAppUseCase,
    private readonly saleRepo: ISaleRepository,
    private readonly whatsAppDeliveryLogRepo: IWhatsAppDeliveryLogRepository,
    private readonly setProviderUseCase: SetElectronicInvoicingProviderUseCase,
    private readonly getProviderSettingsUseCase: GetElectronicInvoicingProviderSettingsUseCase
  ) {}

  getProviderSettings = async (_req: Request, res: Response, next: NextFunction) => {
    try {
      res.json(await this.getProviderSettingsUseCase.execute());
    } catch (err) {
      next(err);
    }
  };

  setProviderSettings = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const body = setElectronicInvoicingProviderSchema.parse(req.body);
      await this.setProviderUseCase.execute(body);
      res.status(204).send();
    } catch (err) {
      next(err);
    }
  };

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
      const invoice = await this.getInvoiceUseCase.execute({ type: "sale", id: req.params.saleId });
      const { xmlContent: _xmlContent, signedXmlContent: _signedXmlContent, ...metadata } = invoice;
      res.json(metadata);
    } catch (err) {
      next(err);
    }
  };

  getXmlBySale = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const invoice = await this.getInvoiceUseCase.execute({ type: "sale", id: req.params.saleId });
      res.type("application/xml").send(invoice.signedXmlContent ?? invoice.xmlContent);
    } catch (err) {
      next(err);
    }
  };

  resubmit = async (req: Request, res: Response, next: NextFunction) => {
    try {
      await this.resubmitUseCase.execute({ type: "sale", id: req.params.saleId });
      res.status(204).send();
    } catch (err) {
      next(err);
    }
  };

  // ---- Factura manual (modules/manual-invoicing, sin POS/producto) -- mismos handlers que
  // arriba, misma entidad ElectronicInvoice, discriminador "manual" en vez de "sale". ----

  getByManualInvoice = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const invoice = await this.getInvoiceUseCase.execute({ type: "manual", id: req.params.manualInvoiceId });
      const { xmlContent: _xmlContent, signedXmlContent: _signedXmlContent, ...metadata } = invoice;
      res.json(metadata);
    } catch (err) {
      next(err);
    }
  };

  getXmlByManualInvoice = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const invoice = await this.getInvoiceUseCase.execute({ type: "manual", id: req.params.manualInvoiceId });
      res.type("application/xml").send(invoice.signedXmlContent ?? invoice.xmlContent);
    } catch (err) {
      next(err);
    }
  };

  resubmitManualInvoice = async (req: Request, res: Response, next: NextFunction) => {
    try {
      await this.resubmitUseCase.execute({ type: "manual", id: req.params.manualInvoiceId });
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

  // ---- RIDE (representacion grafica en PDF), ver application/ride-data-mapper.ts +
  // infrastructure/pdfkit-ride-renderer.ts. Reusa el mismo Get*UseCase que ya sirve el XML.
  // `?format=thermal` cambia al layout de tirilla de 80mm (renderThermalReceiptPdf) pensado para
  // imprimirse en una impresora termica de mostrador; sin el query param, el A4 de siempre. ----

  private async renderPdf(data: RideDocumentData, req: Request): Promise<Buffer> {
    return req.query.format === "thermal" ? renderThermalReceiptPdf(data) : renderRidePdf(data);
  }

  getPdfBySale = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const invoice = await this.getInvoiceUseCase.execute({ type: "sale", id: req.params.saleId });
      const pdf = await this.renderPdf(mapInvoiceToRideData(invoice), req);
      res.type("application/pdf").send(pdf);
    } catch (err) {
      next(err);
    }
  };

  getPdfByManualInvoice = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const invoice = await this.getInvoiceUseCase.execute({ type: "manual", id: req.params.manualInvoiceId });
      const pdf = await this.renderPdf(mapInvoiceToRideData(invoice), req);
      res.type("application/pdf").send(pdf);
    } catch (err) {
      next(err);
    }
  };

  getPdfByCreditNote = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const note = await this.getCreditNoteUseCase.execute(req.params.creditNoteId);
      const pdf = await this.renderPdf(mapNoteToRideData(note, "CREDIT"), req);
      res.type("application/pdf").send(pdf);
    } catch (err) {
      next(err);
    }
  };

  getPdfByDebitNote = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const note = await this.getDebitNoteUseCase.execute(req.params.debitNoteId);
      const pdf = await this.renderPdf(mapNoteToRideData(note, "DEBIT"), req);
      res.type("application/pdf").send(pdf);
    } catch (err) {
      next(err);
    }
  };

  getPdfBySupportDocument = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const doc = await this.getSupportDocumentUseCase.execute(req.params.purchaseId);
      const pdf = await this.renderPdf(mapSupportDocumentToRideData(doc), req);
      res.type("application/pdf").send(pdf);
    } catch (err) {
      next(err);
    }
  };

  getPdfByPayrollDetail = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const doc = await this.getPayrollUseCase.execute(req.params.payrollDetailId);
      const pdf = await this.renderPdf(mapPayrollToRideData(doc), req);
      res.type("application/pdf").send(pdf);
    } catch (err) {
      next(err);
    }
  };

  // ---- Envio del RIDE por WhatsApp (item 41 de docs/ALCANCE.md), ver
  // application/use-cases/send-invoice-whatsapp.use-case.ts. ----

  listSaleWhatsAppDeliveries = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const deliveries = await this.whatsAppDeliveryLogRepo.list({
        companyId: getTenantContext().companyId,
        messageType: "SALE_INVOICE_RIDE",
        referenceId: req.params.saleId,
      });
      res.json({ data: deliveries });
    } catch (err) {
      next(err);
    }
  };

  resendSaleWhatsApp = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const sale = await this.saleRepo.findByIdOrThrow(req.params.saleId);
      await this.sendInvoiceWhatsAppUseCase.execute({ saleId: sale.id, customerId: sale.customerId });
      res.status(204).send();
    } catch (err) {
      next(err);
    }
  };
}
