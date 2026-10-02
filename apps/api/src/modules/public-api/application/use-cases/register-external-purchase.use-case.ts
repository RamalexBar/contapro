import type { RegisterExternalPurchaseInput } from "@erp/shared-types";
import type { ISupplierRepository } from "../../../suppliers/domain/supplier.repository";
import type { CreatePurchaseUseCase } from "../../../suppliers/application/use-cases/create-purchase.use-case";

export interface ExternalPurchaseResult {
  id: string;
  accountPayableId: string;
  total: number;
  status: string;
}

/**
 * Capa delgada sobre CreatePurchaseUseCase (modulo suppliers) -- esa pieza ya hace exactamente lo
 * que un POS externo necesita: recibe los totales de la factura del proveedor (sin lineas de
 * producto, sin catalogo de Contapro), crea la cuenta por pagar y contabiliza (Inventario/Gasto +
 * IVA descontable contra Proveedores), ver create-purchase.use-case.ts. A diferencia de las
 * ventas (shift-close) y la factura electronica, las compras SI se contabilizan por este
 * endpoint: el usuario las excluyo a proposito del cierre de turno porque son un movimiento
 * distinto y no se solapan con la caja de ventas (ver public-api/README.md).
 *
 * Sin retenciones: el POS no las calcula, se manda siempre withholdings: [] (igual que el
 * formulario interno cuando el contador no marca ninguna).
 */
export class RegisterExternalPurchaseUseCase {
  constructor(
    private readonly supplierRepo: ISupplierRepository,
    private readonly createPurchase: CreatePurchaseUseCase
  ) {}

  async execute(input: RegisterExternalPurchaseInput): Promise<ExternalPurchaseResult> {
    const supplierId = await this.resolveSupplierId(input.supplier);
    const purchase = await this.createPurchase.execute({
      branchId: input.branchId,
      supplierId,
      invoiceNumber: input.invoiceNumber,
      subtotal: input.subtotal,
      taxTotal: input.taxTotal,
      total: input.total,
      dueDate: input.dueDate,
      currency: input.currency,
      exchangeRate: input.exchangeRate,
      withholdings: [],
    });
    return {
      id: purchase.id,
      accountPayableId: purchase.accountPayableId,
      total: purchase.total,
      status: purchase.status,
    };
  }

  private async resolveSupplierId(supplier: RegisterExternalPurchaseInput["supplier"]): Promise<string> {
    const existing = await this.supplierRepo.findByNit(supplier.nit);
    if (existing) return existing.id;
    const created = await this.supplierRepo.create({
      name: supplier.name,
      nit: supplier.nit,
      documentType: supplier.documentType,
      isObligatedToInvoice: supplier.isObligatedToInvoice,
    });
    return created.id;
  }
}
