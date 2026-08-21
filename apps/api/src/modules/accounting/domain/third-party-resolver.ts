export interface ThirdPartyRef {
  id: string;
  name: string;
}

/** Cuentas del PUC para las que el Balance General puede desglosar el saldo por tercero (item
 * nuevo, a pedido del usuario). Limitado a las dos que tienen un tercero identificable de punta a
 * punta en el sistema -- el resto de cuentas (Caja, Bancos, Inventarios, Gastos, etc.) no tienen
 * ningun cliente/proveedor asociado en ningun lado del schema. */
export const THIRD_PARTY_BREAKDOWN_ACCOUNT_CODES = new Set(["1305", "2205"]);

/** Resuelve el cliente/proveedor detras de una linea de comprobante segun su sourceType/sourceId
 * (ver STANDARD_ACCOUNTS y sourceType en cada Post*JournalEntryUseCase). Solo reconoce los 5
 * sourceType que efectivamente tocan 1305/2205: Sale, Return, Purchase, SupplierPayment,
 * AccountReceivablePayment. Cualquier otro (o una venta sin cliente asignado, "consumidor final")
 * simplemente no aparece en el mapa devuelto -- el llamador (AccountingReportsService) agrupa esas
 * lineas como "Sin tercero identificado". */
export interface IThirdPartyResolver {
  resolveForLines(lines: { sourceType: string | null; sourceId: string | null }[]): Promise<Map<string, ThirdPartyRef>>;
}
