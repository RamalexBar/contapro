import type { SaleStatus } from "@erp/shared-types";

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
  paymentStatus: "PAID" | "PARTIAL" | "CREDIT" | "PENDING";
  items: ComputedSaleItem[];
  payments: SalePayment[];
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
  cufe: string | null;
  cude: string | null;
  invoiceXmlUrl: string | null;
  createdAt: Date;
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
}
