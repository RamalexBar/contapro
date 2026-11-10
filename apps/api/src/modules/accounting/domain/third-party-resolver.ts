export interface ThirdPartyRef {
  id: string;
  name: string;
  /** NIT / documento del tercero cuando se conoce (null para beneficiarios de gastos, que son texto libre). */
  document?: string | null;
}

/** Cuentas del PUC para las que el Balance General puede desglosar el saldo por tercero (item
 * nuevo, a pedido del usuario). Limitado a las dos que tienen un tercero identificable de punta a
 * punta en el sistema -- el resto de cuentas (Caja, Bancos, Inventarios, Gastos, etc.) no tienen
 * ningun cliente/proveedor asociado en ningun lado del schema. */
export const THIRD_PARTY_BREAKDOWN_ACCOUNT_CODES = new Set(["1305", "2205"]);

/** Resuelve el tercero detras de una linea de comprobante segun el sourceType/sourceId de su comprobante (ver
 * sourceType en cada Post*JournalEntryUseCase): Sale, Return, ManualInvoice y AccountReceivablePayment -> cliente;
 * Purchase y SupplierPayment -> proveedor; Commission -> vendedor; Expense -> beneficiario (texto libre, sin NIT).
 * Cualquier otro (cierres de caja, nomina global, depreciacion, comprobantes manuales) o una venta sin cliente
 * ("consumidor final") no aparece en el mapa devuelto -- el llamador lo agrupa como "Sin tercero identificado". */
export interface IThirdPartyResolver {
  resolveForLines(lines: { sourceType: string | null; sourceId: string | null }[]): Promise<Map<string, ThirdPartyRef>>;
}
