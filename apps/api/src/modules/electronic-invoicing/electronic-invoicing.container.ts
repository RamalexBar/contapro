import { PrismaAuditLogRepository } from "../audit/infrastructure/prisma-audit-log.repository";
import { AuditService } from "../audit/application/audit.service";
import { customerRepo } from "../customers/customer.container";
import { PrismaSupplierRepository } from "../suppliers/infrastructure/prisma-supplier.repository";
import { employeeRepo } from "../employees/employees.container";
import { PrismaElectronicInvoiceRepository } from "./infrastructure/prisma-electronic-invoice.repository";
import { PrismaElectronicCreditNoteRepository } from "./infrastructure/prisma-electronic-credit-note.repository";
import { PrismaElectronicDebitNoteRepository } from "./infrastructure/prisma-electronic-debit-note.repository";
import { PrismaElectronicSupportDocumentRepository } from "./infrastructure/prisma-electronic-support-document.repository";
import { PrismaElectronicPayrollRepository } from "./infrastructure/prisma-electronic-payroll.repository";
import { PrismaInvoiceNumberingResolutionRepository } from "./infrastructure/prisma-invoice-numbering-resolution.repository";
import { PrismaCompanyReaderRepository } from "./infrastructure/prisma-company-reader.repository";
import { NodeForgeCertificateLoader } from "./infrastructure/node-forge-certificate-loader";
import { XadesXmlSigner } from "./infrastructure/xades-xml-signer";
import { DianSoapClient } from "./infrastructure/dian-soap-client";
import { DianNominaSoapClient } from "./infrastructure/dian-nomina-soap-client";
import { MatiasInvoicingClient } from "./infrastructure/matias-invoicing-client";
import { GenerateElectronicInvoiceUseCase } from "./application/use-cases/generate-electronic-invoice.use-case";
import { GenerateElectronicCreditNoteUseCase } from "./application/use-cases/generate-electronic-credit-note.use-case";
import { GenerateElectronicDebitNoteUseCase } from "./application/use-cases/generate-electronic-debit-note.use-case";
import { GenerateElectronicSupportDocumentUseCase } from "./application/use-cases/generate-electronic-support-document.use-case";
import { GenerateElectronicPayrollUseCase } from "./application/use-cases/generate-electronic-payroll.use-case";
import { CreateNumberingResolutionUseCase } from "./application/use-cases/create-numbering-resolution.use-case";
import { ListNumberingResolutionsUseCase } from "./application/use-cases/list-numbering-resolutions.use-case";
import { GetElectronicInvoiceUseCase } from "./application/use-cases/get-electronic-invoice.use-case";
import { GetElectronicCreditNoteUseCase } from "./application/use-cases/get-electronic-credit-note.use-case";
import { GetElectronicDebitNoteUseCase } from "./application/use-cases/get-electronic-debit-note.use-case";
import { GetElectronicSupportDocumentUseCase } from "./application/use-cases/get-electronic-support-document.use-case";
import { GetElectronicPayrollUseCase } from "./application/use-cases/get-electronic-payroll.use-case";
import { ResubmitElectronicInvoiceUseCase } from "./application/use-cases/resubmit-electronic-invoice.use-case";
import { ResubmitElectronicCreditNoteUseCase } from "./application/use-cases/resubmit-electronic-credit-note.use-case";
import { ResubmitElectronicDebitNoteUseCase } from "./application/use-cases/resubmit-electronic-debit-note.use-case";
import { ResubmitElectronicSupportDocumentUseCase } from "./application/use-cases/resubmit-electronic-support-document.use-case";
import { ResubmitElectronicPayrollUseCase } from "./application/use-cases/resubmit-electronic-payroll.use-case";
import { PollDianSubmissionsUseCase } from "./application/use-cases/poll-dian-submissions.use-case";
import { SetElectronicInvoicingProviderUseCase } from "./application/use-cases/set-electronic-invoicing-provider.use-case";
import { GetElectronicInvoicingProviderSettingsUseCase } from "./application/use-cases/get-electronic-invoicing-provider-settings.use-case";
import { SendInvoiceWhatsAppUseCase } from "./application/use-cases/send-invoice-whatsapp.use-case";
import { PrismaSaleRepository } from "../pos/sale/infrastructure/prisma-sale.repository";
import { whatsAppSender, whatsAppDeliveryLogRepo } from "../whatsapp/whatsapp.container";
import { ElectronicInvoicingController } from "./interfaces/electronic-invoicing.controller";

const electronicInvoiceRepo = new PrismaElectronicInvoiceRepository();
const electronicCreditNoteRepo = new PrismaElectronicCreditNoteRepository();
const electronicDebitNoteRepo = new PrismaElectronicDebitNoteRepository();
const electronicSupportDocumentRepo = new PrismaElectronicSupportDocumentRepository();
const electronicPayrollRepo = new PrismaElectronicPayrollRepository();
const numberingResolutionRepo = new PrismaInvoiceNumberingResolutionRepository();
const companyReader = new PrismaCompanyReaderRepository();
// Instancia propia, no importada de suppliers.container.ts: ese container importa
// generateElectronicSupportDocumentUseCase de aqui, importar en la otra direccion crearia un
// ciclo de modulos. PrismaSupplierRepository no tiene estado propio, instanciarla dos veces es
// seguro (misma logica que ya usan otros repos de este container).
const supplierRepo = new PrismaSupplierRepository();
const auditService = new AuditService(new PrismaAuditLogRepository());
const certificateLoader = new NodeForgeCertificateLoader();
const xmlSigner = new XadesXmlSigner();
const dianClient = new DianSoapClient();
// Servicio DIAN distinto para nomina electronica -- ver aviso de cabecera en
// dian-nomina-soap-client.ts. employeeRepo si se importa directo de employees.container.ts
// (sin riesgo de ciclo: ese container no importa nada de aqui, a diferencia de suppliers).
const dianNominaClient = new DianNominaSoapClient();
// Proveedor tecnologico DIAN alternativo (ver README, seccion "Proveedor tecnologico (MATIAS
// API)") -- solo se usa cuando Company.electronicInvoicingProvider === "MATIAS", ver
// GenerateElectronicInvoiceUseCase/ResubmitElectronicInvoiceUseCase.
const thirdPartyInvoicingClient = new MatiasInvoicingClient();
const setProviderUseCase = new SetElectronicInvoicingProviderUseCase(companyReader, auditService);
const getProviderSettingsUseCase = new GetElectronicInvoicingProviderSettingsUseCase(companyReader);

const createResolutionUseCase = new CreateNumberingResolutionUseCase(numberingResolutionRepo, auditService);
const listResolutionsUseCase = new ListNumberingResolutionsUseCase(numberingResolutionRepo);
const getInvoiceUseCase = new GetElectronicInvoiceUseCase(electronicInvoiceRepo);
const resubmitUseCase = new ResubmitElectronicInvoiceUseCase(
  electronicInvoiceRepo,
  certificateLoader,
  xmlSigner,
  auditService,
  companyReader,
  thirdPartyInvoicingClient
);
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
const getSupportDocumentUseCase = new GetElectronicSupportDocumentUseCase(electronicSupportDocumentRepo);
const resubmitSupportDocumentUseCase = new ResubmitElectronicSupportDocumentUseCase(
  electronicSupportDocumentRepo,
  certificateLoader,
  xmlSigner,
  auditService
);
const getPayrollUseCase = new GetElectronicPayrollUseCase(electronicPayrollRepo);
// Instancia propia, no importada de sale.container.ts: ese container importa
// sendInvoiceWhatsAppUseCase de aqui, importar en la otra direccion crearia un ciclo de modulos.
// PrismaSaleRepository no tiene estado propio, instanciarla dos veces es segura (mismo criterio
// que supplierRepo mas arriba).
const saleRepoForWhatsApp = new PrismaSaleRepository();
/** Usado por sale.container.ts (al completar una venta) y por el endpoint de reenvio manual de
 * este mismo modulo. */
export const sendInvoiceWhatsAppUseCase = new SendInvoiceWhatsAppUseCase(
  customerRepo,
  getInvoiceUseCase,
  whatsAppSender,
  whatsAppDeliveryLogRepo,
  auditService
);
const resubmitPayrollUseCase = new ResubmitElectronicPayrollUseCase(
  electronicPayrollRepo,
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
  resubmitDebitNoteUseCase,
  getSupportDocumentUseCase,
  resubmitSupportDocumentUseCase,
  getPayrollUseCase,
  resubmitPayrollUseCase,
  sendInvoiceWhatsAppUseCase,
  saleRepoForWhatsApp,
  whatsAppDeliveryLogRepo,
  setProviderUseCase,
  getProviderSettingsUseCase
);

/** Usado por sale.container.ts para generar el CUFE/XML local (y firmar si hay certificado
 * configurado) al completarse una venta. */
export const generateElectronicInvoiceUseCase = new GenerateElectronicInvoiceUseCase(
  electronicInvoiceRepo,
  companyReader,
  customerRepo,
  auditService,
  certificateLoader,
  xmlSigner,
  thirdPartyInvoicingClient
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

/** Usado por suppliers.container.ts para generar el CUDS/XML local (y firmar si hay certificado
 * configurado) al registrar una compra a un proveedor no obligado a facturar. */
export const generateElectronicSupportDocumentUseCase = new GenerateElectronicSupportDocumentUseCase(
  electronicSupportDocumentRepo,
  companyReader,
  supplierRepo,
  auditService,
  certificateLoader,
  xmlSigner
);

/** Usado por payroll.container.ts para generar el CUNE/XML local (y firmar si hay certificado
 * configurado) por cada empleado al aprobar un periodo de nomina. */
export const generateElectronicPayrollUseCase = new GenerateElectronicPayrollUseCase(
  electronicPayrollRepo,
  companyReader,
  employeeRepo,
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
export const pollDianSupportDocumentSubmissionsUseCase = new PollDianSubmissionsUseCase(
  electronicSupportDocumentRepo,
  dianClient,
  auditService,
  "Purchase",
  "Documento soporte electronico"
);
/** Usa dianNominaClient (servicio DIAN separado), no el dianClient compartido. */
export const pollDianPayrollSubmissionsUseCase = new PollDianSubmissionsUseCase(
  electronicPayrollRepo,
  dianNominaClient,
  auditService,
  "PayrollDetail",
  "Nomina electronica"
);
