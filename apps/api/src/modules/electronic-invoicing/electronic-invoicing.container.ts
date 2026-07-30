import { PrismaAuditLogRepository } from "../audit/infrastructure/prisma-audit-log.repository";
import { AuditService } from "../audit/application/audit.service";
import { customerRepo } from "../customers/customer.container";
import { PrismaElectronicInvoiceRepository } from "./infrastructure/prisma-electronic-invoice.repository";
import { PrismaElectronicCreditNoteRepository } from "./infrastructure/prisma-electronic-credit-note.repository";
import { PrismaElectronicDebitNoteRepository } from "./infrastructure/prisma-electronic-debit-note.repository";
import { PrismaInvoiceNumberingResolutionRepository } from "./infrastructure/prisma-invoice-numbering-resolution.repository";
import { PrismaCompanyReaderRepository } from "./infrastructure/prisma-company-reader.repository";
import { NodeForgeCertificateLoader } from "./infrastructure/node-forge-certificate-loader";
import { XadesXmlSigner } from "./infrastructure/xades-xml-signer";
import { DianSoapClient } from "./infrastructure/dian-soap-client";
import { GenerateElectronicInvoiceUseCase } from "./application/use-cases/generate-electronic-invoice.use-case";
import { GenerateElectronicCreditNoteUseCase } from "./application/use-cases/generate-electronic-credit-note.use-case";
import { GenerateElectronicDebitNoteUseCase } from "./application/use-cases/generate-electronic-debit-note.use-case";
import { CreateNumberingResolutionUseCase } from "./application/use-cases/create-numbering-resolution.use-case";
import { ListNumberingResolutionsUseCase } from "./application/use-cases/list-numbering-resolutions.use-case";
import { GetElectronicInvoiceUseCase } from "./application/use-cases/get-electronic-invoice.use-case";
import { GetElectronicCreditNoteUseCase } from "./application/use-cases/get-electronic-credit-note.use-case";
import { GetElectronicDebitNoteUseCase } from "./application/use-cases/get-electronic-debit-note.use-case";
import { ResubmitElectronicInvoiceUseCase } from "./application/use-cases/resubmit-electronic-invoice.use-case";
import { ResubmitElectronicCreditNoteUseCase } from "./application/use-cases/resubmit-electronic-credit-note.use-case";
import { ResubmitElectronicDebitNoteUseCase } from "./application/use-cases/resubmit-electronic-debit-note.use-case";
import { PollDianSubmissionsUseCase } from "./application/use-cases/poll-dian-submissions.use-case";
import { ElectronicInvoicingController } from "./interfaces/electronic-invoicing.controller";

const electronicInvoiceRepo = new PrismaElectronicInvoiceRepository();
const electronicCreditNoteRepo = new PrismaElectronicCreditNoteRepository();
const electronicDebitNoteRepo = new PrismaElectronicDebitNoteRepository();
const numberingResolutionRepo = new PrismaInvoiceNumberingResolutionRepository();
const companyReader = new PrismaCompanyReaderRepository();
const auditService = new AuditService(new PrismaAuditLogRepository());
const certificateLoader = new NodeForgeCertificateLoader();
const xmlSigner = new XadesXmlSigner();
const dianClient = new DianSoapClient();

const createResolutionUseCase = new CreateNumberingResolutionUseCase(numberingResolutionRepo, auditService);
const listResolutionsUseCase = new ListNumberingResolutionsUseCase(numberingResolutionRepo);
const getInvoiceUseCase = new GetElectronicInvoiceUseCase(electronicInvoiceRepo);
const resubmitUseCase = new ResubmitElectronicInvoiceUseCase(electronicInvoiceRepo, certificateLoader, xmlSigner, auditService);
const getCreditNoteUseCase = new GetElectronicCreditNoteUseCase(electronicCreditNoteRepo);
const resubmitCreditNoteUseCase = new ResubmitElectronicCreditNoteUseCase(
  electronicCreditNoteRepo,
  certificateLoader,
  xmlSigner,
  auditService
);
const getDebitNoteUseCase = new GetElectronicDebitNoteUseCase(electronicDebitNoteRepo);
const resubmitDebitNoteUseCase = new ResubmitElectronicDebitNoteUseCase(
  electronicDebitNoteRepo,
  certificateLoader,
  xmlSigner,
  auditService
);

export const electronicInvoicingController = new ElectronicInvoicingController(
  createResolutionUseCase,
  listResolutionsUseCase,
  getInvoiceUseCase,
  resubmitUseCase,
  getCreditNoteUseCase,
  resubmitCreditNoteUseCase,
  getDebitNoteUseCase,
  resubmitDebitNoteUseCase
);

/** Usado por sale.container.ts para generar el CUFE/XML local (y firmar si hay certificado
 * configurado) al completarse una venta. */
export const generateElectronicInvoiceUseCase = new GenerateElectronicInvoiceUseCase(
  electronicInvoiceRepo,
  companyReader,
  customerRepo,
  auditService,
  certificateLoader,
  xmlSigner
);

/** Usado por credit-note.container.ts para generar el CUDE/XML local (y firmar si hay
 * certificado configurado) al emitir una nota credito que referencia una venta facturada. */
export const generateElectronicCreditNoteUseCase = new GenerateElectronicCreditNoteUseCase(
  electronicCreditNoteRepo,
  electronicInvoiceRepo,
  companyReader,
  customerRepo,
  auditService,
  certificateLoader,
  xmlSigner
);

/** Usado por debit-note.container.ts, analogo a generateElectronicCreditNoteUseCase. */
export const generateElectronicDebitNoteUseCase = new GenerateElectronicDebitNoteUseCase(
  electronicDebitNoteRepo,
  electronicInvoiceRepo,
  companyReader,
  customerRepo,
  auditService,
  certificateLoader,
  xmlSigner
);

/** Usado por server.ts para arrancar el poller de envio/consulta de estado a la DIAN (una
 * instancia por tipo de documento -- ver dian-submission-poller.ts). */
export const pollDianSubmissionsUseCase = new PollDianSubmissionsUseCase(
  electronicInvoiceRepo,
  dianClient,
  auditService,
  "Sale",
  "Factura electronica"
);
export const pollDianCreditNoteSubmissionsUseCase = new PollDianSubmissionsUseCase(
  electronicCreditNoteRepo,
  dianClient,
  auditService,
  "CreditNote",
  "Nota credito electronica"
);
export const pollDianDebitNoteSubmissionsUseCase = new PollDianSubmissionsUseCase(
  electronicDebitNoteRepo,
  dianClient,
  auditService,
  "DebitNote",
  "Nota debito electronica"
);
