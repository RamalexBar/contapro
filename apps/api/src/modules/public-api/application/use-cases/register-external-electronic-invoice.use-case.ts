import type { RegisterExternalElectronicInvoiceInput } from "@erp/shared-types";
import { NotFoundError } from "../../../../shared/errors/app-error";
import type { ICustomerRepository } from "../../../customers/domain/customer.repository";
import type { CreateManualInvoiceUseCase } from "../../../manual-invoicing/application/use-cases/create-manual-invoice.use-case";
import type { GetElectronicInvoiceUseCase } from "../../../electronic-invoicing/application/use-cases/get-electronic-invoice.use-case";

export interface ExternalElectronicInvoiceResult {
  id: string;
  fullNumber: string | null;
  cufe: string | null;
  // "PENDING": la factura manual se creo pero la generacion DIAN todavia no corrio o fallo
  // (CreateManualInvoiceUseCase nunca bloquea por esto, ver su propio comentario) -- cualquier
  // otro valor es el status real de ElectronicInvoice (GENERATED, PENDING_SUBMISSION, ACCEPTED,
  // REJECTED, segun el proveedor configurado).
  status: string;
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
    private readonly getElectronicInvoice: GetElectronicInvoiceUseCase
  ) {}

  async execute(input: RegisterExternalElectronicInvoiceInput): Promise<ExternalElectronicInvoiceResult> {
    const customerId = input.buyer ? await this.resolveCustomerId(input.buyer) : null;

    const manualInvoice = await this.createManualInvoice.execute({
      branchId: input.branchId,
      customerId,
      items: input.items,
    });

    try {
      const electronicInvoice = await this.getElectronicInvoice.execute({ type: "manual", id: manualInvoice.id });
      return { id: manualInvoice.id, fullNumber: electronicInvoice.fullNumber, cufe: electronicInvoice.cufe, status: electronicInvoice.status };
    } catch (err) {
      // CreateManualInvoiceUseCase no bloquea si la generacion DIAN falla (ver su propio
      // comentario) -- la factura manual SI se creo, solo no hay ElectronicInvoice todavia.
      if (err instanceof NotFoundError) return { id: manualInvoice.id, fullNumber: null, cufe: null, status: "PENDING" };
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
