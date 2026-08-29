import { apiFetch, openPdfInNewTab } from "../../../lib/api-client";

export interface PurchaseOrderItemInput {
  productId: string;
  quantity: number;
  unitCost: number;
}

export interface PurchaseOrderItemRecord extends PurchaseOrderItemInput {
  id: string;
  total: number;
  receivedQuantity: number;
}

export interface PurchaseOrderRecord {
  id: string;
  branchId: string;
  supplierId: string;
  status: string;
  expectedDate: string | null;
  total: number;
  createdAt: string;
}

export interface PurchaseOrderWithItems extends PurchaseOrderRecord {
  items: PurchaseOrderItemRecord[];
}

export interface CreatePurchaseOrderInput {
  branchId: string;
  supplierId: string;
  expectedDate?: string;
  items: PurchaseOrderItemInput[];
}

export interface GoodsReceiptItemInput {
  productId: string;
  quantity: number;
  unitCost: number;
  batchNumber?: string;
  expirationDate?: string;
}

export interface GoodsReceiptRecord {
  id: string;
  branchId: string;
  supplierId: string;
  purchaseOrderId: string | null;
  receivedByUserId: string;
  createdAt: string;
  items: (GoodsReceiptItemInput & { id: string })[];
}

export interface CreateGoodsReceiptInput {
  branchId: string;
  supplierId: string;
  purchaseOrderId?: string;
  items: GoodsReceiptItemInput[];
}

export function listPurchaseOrders(): Promise<{ data: PurchaseOrderRecord[] }> {
  return apiFetch("/purchase-orders");
}

export function getPurchaseOrder(id: string): Promise<PurchaseOrderWithItems> {
  return apiFetch(`/purchase-orders/${id}`);
}

export function createPurchaseOrder(input: CreatePurchaseOrderInput): Promise<PurchaseOrderRecord> {
  return apiFetch("/purchase-orders", { method: "POST", body: input });
}

export function sendPurchaseOrder(id: string): Promise<PurchaseOrderRecord> {
  return apiFetch(`/purchase-orders/${id}/send`, { method: "POST" });
}

export function printPurchaseOrderPdf(id: string): Promise<void> {
  return openPdfInNewTab(`/purchase-orders/${id}/pdf`);
}

export function listGoodsReceipts(): Promise<{ data: GoodsReceiptRecord[] }> {
  return apiFetch("/goods-receipts");
}

export function receiveGoods(input: CreateGoodsReceiptInput): Promise<GoodsReceiptRecord> {
  return apiFetch("/goods-receipts", { method: "POST", body: input });
}
