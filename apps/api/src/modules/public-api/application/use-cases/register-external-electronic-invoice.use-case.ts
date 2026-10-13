import type { RegisterExternalElectronicInvoiceInput } from "@erp/shared-types";
import { NotFoundError } from "../../../../shared/errors/app-error";
import type { ICustomerRepository } from "../../../customers/domain/customer.repository";
import type { CreateManualInvoiceUseCase } from "../../../manual-invoicing/application/use-cases/create-manual-invoice.use-case";
import type { GetElectronicInvoiceUseCase } from "../../../electronic-invoicing/application/use-cases/get-electronic-invoice.use-case";
import type { IExternalApiRequestRepository } from "../../domain/external-api-request.repository";

const ENDPOINT = "electronic-invoices";

export interface ExternalElectronicInvoiceResult {
  id: string;
  fullNumber: string | null;
  cufe: string | null;
  // "PENDING": la factura manual se creo pero la generacion DIAN todavia no corrio o fallo
  // (CreateManualInvoiceUseCase nunca bloquea por esto, ver su propio comentario) -- cualquier
  // otro valor es el status real de ElectronicInvoice (GENERATED, PENDING_SUBMISSION, ACCEPTED,
  // REJECTED, segun el proveedor configurado).
  status: string;
  /** Ruta del PDF (representacion grafica) en esta misma API, con la misma API key (2026-10-13). */
  pdfPath: string;
}

/**
 * Capa delgada sobre CreateManualInvoiceUseCase (modulo manual-invoicing) -- esa es la pieza
 * correcta para esto porque YA no usa catalogo de productos ni mueve inventario ni contabiliza,
 * exactamente lo que un POS externo con su propio inventario necesita (ver README de
 * public-api). No se duplica logica de negocio, solo se resuelve el comprador por documento (el
 * POS no conoce un customerId de Contapro) antes de delegar.
 */
export class RegisterExternalElectronicInvoiceUseCase {
  constructor(
    private readonly customerRepo: ICustomerRepository,
    private readonly createManualInvoice: CreateManualInvoiceUseCase,
    private readonly getElectronicInvoice: GetElectronicInvoiceUseCase,
    private readonly idempotencyRepo: IExternalApiRequestRepository
  ) {}

  /**
   * Con `externalReference` (header Idempotency-Key, opcional para no romper a quien ya integraba):
   * un reintento del POS (ej. se cayo el internet esperando la respuesta) devuelve la MISMA factura
   * en vez de emitir otra -- facturar dos veces la misma venta ante la DIAN no tiene vuelta atras.
   */
  async execute(input: RegisterExternalElectronicInvoiceInput, externalReference?: string): Promise<ExternalElectronicInvoiceResult> {
    if (!externalReference) return this.register(input);
    const existing = await this.idempotencyRepo.findByReference(ENDPOINT, externalReference);
    if (existing?.status === "POSTED") return existing.responseBody as ExternalElectronicInvoiceResult;
    try {
      const result = await this.register(input);
      if (existing) await this.idempotencyRepo.update(existing.id, { status: "POSTED", responseBody: result });
      else await this.idempotencyRepo.create({ endpoint: ENDPOINT, externalReference, status: "POSTED", responseBody: result });
      return result;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : String(err);
      if (existing) await this.idempotencyRepo.update(existing.id, { status: "FAILED", errorMessage });
      else await this.idempotencyRepo.create({ endpoint: ENDPOINT, externalReference, status: "FAILED", errorMessage });
      throw err;
    }
  }

  private async register(input: RegisterExternalElectronicInvoiceInput): Promise<ExternalElectronicInvoiceResult> {
    const customerId = input.buyer ? await this.resolveCustomerId(input.buyer) : null;

    const manualInvoice = await this.createManualInvoice.execute({
      branchId: input.branchId,
      customerId,
      items: input.items,
    });

    try {
      const electronicInvoice = await this.getElectronicInvoice.execute({ type: "manual", id: manualInvoice.id });
      return { id: manualInvoice.id, fullNumber: electronicInvoice.fullNumber, cufe: electronicInvoice.cufe, status: electronicInvoice.status, pdfPath: pdfPath(manualInvoice.id) };
    } catch (err) {
      // CreateManualInvoiceUseCase no bloquea si la generacion DIAN falla (ver su propio
      // comentario) -- la factura manual SI se creo, solo no hay ElectronicInvoice todavia.
      if (err instanceof NotFoundError) return { id: manualInvoice.id, fullNumber: null, cufe: null, status: "PENDING", pdfPath: pdfPath(manualInvoice.id) };
      throw err;
    }
  }

  private async resolveCustomerId(buyer: NonNullable<RegisterExternalElectronicInvoiceInput["buyer"]>): Promise<string> {
    const existing = await this.customerRepo.findByDocumentNumber(buyer.documentNumber);
    if (existing) return existing.id;
    const created = await this.customerRepo.create({
      documentType: buyer.documentType,
      documentNumber: buyer.documentNumber,
      name: buyer.name,
      email: buyer.email,
      phone: buyer.phone,
    });
    return created.id;
  }
}

function pdfPath(manualInvoiceId: string): string {
  return `/api/public/v1/electronic-invoices/${manualInvoiceId}/pdf`;
}
