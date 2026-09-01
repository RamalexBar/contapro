import type { SaleStatus } from "@erp/shared-types";
import type { WithholdingType } from "../../../accounting/domain/withholding-concept.repository";

export interface ComputedSaleItem {
  productId: string;
  quantity: number;
  unitPrice: number;
  discountPercent: number;
  discountAmount: number;
  taxPercent: number;
  taxAmount: number;
  total: number;
  requiresDiscountAuthorization: boolean;
}

export interface SalePayment {
  method: string;
  amount: number;
  reference?: string;
}

export interface ComputedSaleWithholding {
  withholdingConceptId: string;
  type: WithholdingType;
  base: number;
  ratePercent: number;
  amount: number;
}

/** Presente cuando la venta incluye un pago method="CREDIT" y por lo tanto genera una
 * AccountReceivable (item 31 de docs/ALCANCE.md, modulo `collections`) -- ver
 * resolve-receivable-input.ts para como se calcula. */
export interface ReceivableInput {
  customerId: string;
  amount: number;
  dueDate: Date;
}

export interface CreateSaleData {
  branchId: string;
  cashSessionId?: string;
  customerId?: string;
  sellerUserId: string;
  status: SaleStatus;
  subtotal: number;
  discountTotal: number;
  taxTotal: number;
  total: number;
  retentionTotal: number;
  paymentStatus: "PAID" | "PARTIAL" | "CREDIT" | "PENDING";
  items: ComputedSaleItem[];
  payments: SalePayment[];
  withholdings: ComputedSaleWithholding[];
  receivable?: ReceivableInput;
  // Presente solo cuando la venta queda PENDING_AUTHORIZATION y el cajero pidio un plazo de
  // credito especifico -- se persiste para que AuthorizeDiscountUseCase lo recupere al completar
  // la venta, en vez de caer siempre en el default de 30 dias (ver resolve-receivable-input.ts).
  requestedReceivableDueDate?: Date;
  // Multi-moneda informativa (item 33 de docs/ALCANCE.md) -- ver pos.prisma.
  currency: string;
  exchangeRate: number;
  // Lista de precios efectiva ya resuelta por CreateSaleUseCase (item 35) -- informativa, el
  // precio real ya quedo fijado por item en ComputedSaleItem.unitPrice. Null = precio base.
  priceListId: string | null;
}

export interface SaleRecord {
  id: string;
  companyId: string;
  branchId: string;
  number: number;
  customerId: string | null;
  sellerUserId: string;
  status: SaleStatus;
  paymentStatus: string;
  subtotal: number;
  discountTotal: number;
  taxTotal: number;
  total: number;
  retentionTotal: number;
  cufe: string | null;
  cude: string | null;
  invoiceXmlUrl: string | null;
  createdAt: Date;
  accountReceivableId: string | null;
  requestedReceivableDueDate: Date | null;
  // Multi-moneda informativa (item 33) -- foreignTotal es derivado (null si currency === "COP"),
  // nunca una segunda fuente de verdad. Ver prisma-sale.repository.ts.
  currency: string;
  exchangeRate: number;
  foreignTotal: number | null;
  priceListId: string | null;
  withholdings: Array<{ withholdingConceptId: string; type: WithholdingType; base: number; ratePercent: number; amount: number }>;
  items: Array<{
    id: string;
    productId: string;
    quantity: number;
    unitPrice: number;
    discountPercent: number;
    taxPercent: number;
    taxAmount: number;
    total: number;
    requiresDiscountAuthorization: boolean;
    discountAuthorizationId: string | null;
  }>;
  payments: Array<{ method: string; amount: number }>;
  // Costo real de lo vendido (FIFO: suma de los lotes realmente consumidos; promedio/ultimo: al
  // costo del producto al momento de la venta), calculado por PrismaSaleRepository al completar
  // la venta -- ver applyCompletionSideEffects. Queda en 0 cuando la venta todavia no se
  // completo (PENDING_AUTHORIZATION) o para metodos del repositorio que no lo recalculan
  // (findByIdOrThrow/list/etc.), ya que solo lo consumen CreateSaleUseCase/AuthorizeDiscountUseCase
  // justo al completarse, para contabilizar el costo de venta (ver post-sale-journal-entry).
  costTotal: number;
}

export interface ISaleRepository {
  create(data: CreateSaleData): Promise<SaleRecord>;
  findByIdOrThrow(id: string): Promise<SaleRecord>;
  /**
   * Marca un item con su autorizacion de descuento. Si tras esto ya no quedan items
   * pendientes, completa la venta atomicamente: descuenta stock y registra el ingreso en caja.
   */
  authorizeItemDiscount(saleId: string, saleItemId: string, discountAuthorizationId: string): Promise<SaleRecord>;
  cancel(id: string, reason: string): Promise<SaleRecord>;
  list(filters: { take?: number; skip?: number }): Promise<SaleRecord[]>;
  /** Todas las ventas COMPLETED/RETURNED_PARTIAL (excluye CANCELLED/RETURNED_FULL/borradores)
   * creadas dentro del año calendario dado -- usado por el reporte de informacion exogena DIAN
   * (item 37 de docs/ALCANCE.md). Sin paginar. */
  listForYear(year: number): Promise<SaleRecord[]>;
  /** Igual que listForYear pero acotado a un mes -- usado por CalculateCommissionsUseCase (item 38
   * de docs/ALCANCE.md). */
  listForPeriod(year: number, month: number): Promise<SaleRecord[]>;
}
