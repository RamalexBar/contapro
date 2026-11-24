/** Tercero tal como lo reporta la exogena. */
export interface ExogenaThirdParty {
  id: string;
  documentType: string;
  documentNumber: string;
  name: string;
  municipalityCode: string | null;
}

/** Compra del año: `kind` sale de la cuenta que debito su comprobante (1435, 15xx o gasto). */
export interface ExogenaPurchase {
  supplierId: string;
  subtotal: number;
  taxTotal: number;
  kind: "INVENTORY" | "FIXED_ASSET" | "EXPENSE";
  withholdings: Array<{ type: "RETEFUENTE" | "RETEICA" | "RETEIVA"; conceptCode: string; amount: number }>;
}

/** Ingresos y movimientos de IVA del año, de todas las fuentes de Contapro. */
export interface ExogenaYearData {
  purchases: ExogenaPurchase[];
  /** Ventas del POS no anuladas: subtotal antes de descuento. */
  sales: Array<{ customerId: string | null; subtotal: number; discountTotal: number; taxTotal: number }>;
  /**
   * external = emitida por la API publica para un POS externo: esa venta ya esta en su cierre de turno
   * (shiftCloses, sin cliente), asi que solo aporta la identidad del cliente, no un ingreso adicional.
   */
  manualInvoices: Array<{ customerId: string | null; subtotal: number; ivaTotal: number; incTotal: number; external: boolean }>;
  /** Cierres de turno de un POS externo (combo Cajapro): ventas a consumidor final. */
  shiftCloses: Array<{ base: number; iva: number; inc: number; returnsBase: number; returnsIva: number }>;
  /** Devoluciones (base sin IVA y su IVA), con el cliente de la venta. */
  returns: Array<{ customerId: string | null; base: number; tax: number }>;
  /** Notas credito libres (descuentos, ajustes de precio), separadas en base e IVA. */
  creditNotes: Array<{ customerId: string | null; base: number; tax: number }>;
  suppliers: ExogenaThirdParty[];
  customers: ExogenaThirdParty[];
}

export interface ExogenaEmployee {
  id: string;
  documentType: string;
  documentNumber: string;
  firstName: string;
  middleName: string | null;
  lastName: string;
  secondLastName: string | null;
  address: string | null;
}

/** Pagos laborales del año: items de nominas aprobadas y liquidaciones de prestaciones. */
export interface ExogenaPayrollData {
  employees: ExogenaEmployee[];
  /** Municipio de la empresa (lugar de trabajo), a falta de uno por empleado. */
  workplaceMunicipalityCode: string | null;
  items: Array<{ employeeId: string; conceptCode: string; amount: number }>;
  settlements: Array<{
    employeeId: string;
    type: string;
    lines: Array<{ concept: string; amount: number }>;
    withholding: number;
    toSeveranceFund: number;
  }>;
}

export interface IExogenaDataReader {
  yearData(year: number): Promise<ExogenaYearData>;
  payrollData(year: number): Promise<ExogenaPayrollData>;
}
