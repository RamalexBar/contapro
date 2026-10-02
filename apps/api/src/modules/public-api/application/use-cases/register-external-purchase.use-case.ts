import type { RegisterExternalPurchaseInput } from "@erp/shared-types";
import { calculateNitCheckDigit, round2 } from "@erp/shared-utils";
import { ValidationError } from "../../../../shared/errors/app-error";
import type { ISupplierRepository } from "../../../suppliers/domain/supplier.repository";
import type { IExpenseCategoryRepository } from "../../../expenses/domain/expense-category.repository";
import type { CreatePurchaseUseCase } from "../../../suppliers/application/use-cases/create-purchase.use-case";
import type { RegisterSupplierPaymentUseCase } from "../../../suppliers/application/use-cases/register-supplier-payment.use-case";
import type { IExternalApiRequestRepository } from "../../domain/external-api-request.repository";

const ENDPOINT = "purchases";

export interface ExternalPurchaseResult {
  id: string;
  accountPayableId: string;
  total: number;
  // Estado de la cuenta por pagar DESPUES de este llamado: "PENDING" si quedo a credito, "PAID"
  // si se pago de una vez (termino CASH) -- no el status de Purchase (que siempre es REGISTERED
  // aqui, CANCELLED solo lo deja POST /purchases/:id/cancel).
  accountPayableStatus: string;
}

/**
 * Capa de orquestacion sobre CreatePurchaseUseCase (modulo suppliers) -- esa pieza ya hace
 * exactamente lo que un POS externo necesita: recibe los totales de la factura del proveedor (sin
 * lineas de producto, sin catalogo de Contapro), crea la cuenta por pagar y contabiliza
 * (Inventario/Gasto + IVA descontable contra Proveedores). A diferencia de las ventas
 * (shift-close) y la factura electronica, las compras SI se contabilizan por este endpoint: el
 * usuario las excluyo a proposito del cierre de turno porque son un movimiento distinto y no se
 * solapan con la caja de ventas (ver public-api/README.md).
 *
 * "Contado" se modela como dos comprobantes (compra + abono total inmediato vía
 * RegisterSupplierPaymentUseCase) en vez de uno solo -- mismo efecto economico neto
 * (Inventario/Gasto contra Caja/Bancos), sin tocar el motor contable de compras para un caso
 * especial. Idempotencia por (companyId, endpoint, externalReference) via
 * IExternalApiRequestRepository: un reintento con la misma key devuelve la respuesta ya servida,
 * nunca duplica ni la compra ni el pago.
 *
 * Sin retenciones: el POS no las calcula, se manda siempre withholdings: [] (igual que el
 * formulario interno cuando el contador no marca ninguna).
 */
export class RegisterExternalPurchaseUseCase {
  constructor(
    private readonly supplierRepo: ISupplierRepository,
    private readonly expenseCategoryRepo: IExpenseCategoryRepository,
    private readonly createPurchase: CreatePurchaseUseCase,
    private readonly registerSupplierPayment: RegisterSupplierPaymentUseCase,
    private readonly idempotencyRepo: IExternalApiRequestRepository
  ) {}

  async execute(input: RegisterExternalPurchaseInput, externalReference: string): Promise<ExternalPurchaseResult> {
    const existing = await this.idempotencyRepo.findByReference(ENDPOINT, externalReference);
    if (existing?.status === "POSTED") return existing.responseBody as ExternalPurchaseResult;

    try {
      const result = await this.register(input);
      if (existing) {
        await this.idempotencyRepo.update(existing.id, { status: "POSTED", responseBody: result });
      } else {
        await this.idempotencyRepo.create({ endpoint: ENDPOINT, externalReference, status: "POSTED", responseBody: result });
      }
      return result;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : String(err);
      if (existing) {
        await this.idempotencyRepo.update(existing.id, { status: "FAILED", errorMessage });
      } else {
        await this.idempotencyRepo.create({ endpoint: ENDPOINT, externalReference, status: "FAILED", errorMessage });
      }
      throw err;
    }
  }

  private async register(input: RegisterExternalPurchaseInput): Promise<ExternalPurchaseResult> {
    if (calculateNitCheckDigit(input.supplier.nit) !== input.supplier.dv) {
      throw new ValidationError(`El digito de verificacion no corresponde al NIT ${input.supplier.nit}`);
    }

    const subtotal = round2(input.taxBreakdown.reduce((sum, line) => sum + line.taxableBase, 0));
    const taxTotal = round2(input.taxBreakdown.reduce((sum, line) => sum + line.taxAmount, 0));
    const expectedTotal = round2(subtotal + taxTotal);
    if (expectedTotal !== round2(input.total)) {
      throw new ValidationError(`El total (${input.total}) no coincide con la suma del desglose de IVA (${expectedTotal})`);
    }

    const supplierId = await this.resolveSupplierId(input.supplier);

    let destinationAccount: { code: string; name: string } | undefined;
    if (input.expenseCategoryCode) {
      const category = await this.expenseCategoryRepo.findByCode(input.expenseCategoryCode);
      if (!category) {
        throw new ValidationError(`No existe una categoria de gasto con el codigo "${input.expenseCategoryCode}"`);
      }
      if (!category.isActive) {
        throw new ValidationError(`La categoria de gasto ${category.code} esta inactiva`);
      }
      destinationAccount = { code: category.accountCode, name: category.name };
    }

    const dueDate = input.payment.term === "CREDIT" ? input.payment.dueDate : input.invoiceDate;

    const purchase = await this.createPurchase.execute({
      branchId: input.branchId,
      supplierId,
      invoiceNumber: input.invoiceNumber,
      subtotal,
      taxTotal,
      total: input.total,
      dueDate,
      date: input.invoiceDate,
      destinationAccount,
      withholdings: [],
      currency: input.currency,
      exchangeRate: input.exchangeRate,
    });

    let accountPayableStatus = "PENDING";
    if (input.payment.term === "CASH") {
      const paymentResult = await this.registerSupplierPayment.execute({
        accountPayableId: purchase.accountPayableId,
        amount: purchase.total,
        method: input.payment.method,
      });
      accountPayableStatus = paymentResult.accountPayable.status;
    }

    return { id: purchase.id, accountPayableId: purchase.accountPayableId, total: purchase.total, accountPayableStatus };
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
