/**
 * Lectura de lo vendido y lo devuelto en un periodo, ya con el costo real (PEPS) de cada linea. Sin Prisma: el caso de
 * uso agrupa y calcula margenes sobre estas filas planas.
 */

export interface ProfitabilityLine {
  productId: string;
  productName: string;
  sku: string;
  categoryId: string | null;
  categoryName: string | null;
  customerId: string | null;
  customerName: string | null;
  /** Positiva en ventas, negativa en devoluciones. */
  quantity: number;
  /** Venta neta sin IVA (despues de descuentos). Negativa en devoluciones. */
  revenue: number;
  /** Costo real PEPS. Negativo en devoluciones que volvieron al inventario; 0 si la mercancia devuelta no se reingreso
   * (se perdio: su costo sigue cargado a la venta original). */
  cost: number;
  /** true si la linea no tenia costo guardado y se estimo con el costo actual del producto. */
  estimatedCost: boolean;
}

export interface ProfitabilityFilter {
  from: Date;
  to: Date;
  branchId?: string;
}

export interface IProfitabilityReader {
  listLines(filter: ProfitabilityFilter): Promise<ProfitabilityLine[]>;
}
