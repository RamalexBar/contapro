/** Ventas y devoluciones por tarifa de un periodo, sacadas de los documentos (no del libro mayor):
 * el comprobante contable consolida el IVA de todas las tarifas en una sola linea de 2408, asi que
 * las bases por tarifa del formulario 300 solo se pueden reconstruir desde las ventas. */
export interface TaxRateRow {
  taxType: string; // IVA | INC | EXEMPT | EXCLUDED
  taxRate: number;
  taxableBase: number;
  taxAmount: number;
}

export interface TaxableActivity {
  sales: TaxRateRow[];
  returns: TaxRateRow[];
  /** Cierres de turno anteriores al 2026-10-24 no guardaron su desglose: el IVA si esta en el
   * libro mayor, pero sus bases por tarifa no se pueden mostrar. */
  shiftClosesWithoutDetail: number;
}

export interface IVatActivityReader {
  getTaxableActivity(from: Date, to: Date, branchId?: string): Promise<TaxableActivity>;
}
