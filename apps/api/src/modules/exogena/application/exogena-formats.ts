import { round2 } from "@erp/shared-utils";
import type { ExogenaPayrollData, ExogenaPurchase, ExogenaThirdParty, ExogenaYearData } from "../domain/exogena-data.reader";
import type { ThirdPartyInfo } from "../domain/exogena-report.types";

/**
 * Formatos de exogena calculados a partir de los datos del año (Resolucion DIAN 000227 de 2025 y su
 * correccion 000237 de 2025). Las reglas que salen de la norma estan citadas en cada funcion; el
 * orden exacto de columnas del archivo plano sigue sin validar contra el prevalidador (ver README).
 */

/** Terceros no identificados (consumidor final): un solo registro, tipo de documento 43. */
export const UNIDENTIFIED_DOCUMENT_TYPE = "43";
export const UNIDENTIFIED_DOCUMENT_NUMBER = "222222222";

function unidentified(name: "CUANTIAS MENORES" | "CONSUMIDOR FINAL"): ThirdPartyInfo {
  return { documentType: UNIDENTIFIED_DOCUMENT_TYPE, documentNumber: UNIDENTIFIED_DOCUMENT_NUMBER, name, municipalityCode: null, incompleto: false };
}

function info(party: ExogenaThirdParty | undefined, id: string): ThirdPartyInfo {
  if (!party) return { documentType: "", documentNumber: "", name: `Tercero ${id}`, municipalityCode: null, incompleto: true };
  return {
    documentType: party.documentType,
    documentNumber: party.documentNumber,
    name: party.name,
    municipalityCode: party.municipalityCode,
    incompleto: !party.municipalityCode,
  };
}

const UNIDENTIFIED_KEY = "__sin_identificar__";

// ---------- 1001: pagos o abonos en cuenta ----------

/**
 * Concepto del pago (art. 1.3.5.2.1): el de la retencion practicada si la hay (honorarios 5002,
 * servicios 5004, arrendamientos 5005); si no, por lo que se compro: inventario 5007 (compra de
 * activos movibles), activos fijos 5008, y el resto 5016 (los demas costos y deducciones). Antes todo
 * iba en 5002, que es Honorarios.
 */
const CONCEPT_BY_WITHHOLDING: Record<string, string> = { "RF-HONORARIOS": "5002", "RF-SERVICIOS": "5004", "RF-ARRENDAMIENTOS": "5005" };
const CONCEPT_BY_KIND: Record<ExogenaPurchase["kind"], string> = { INVENTORY: "5007", FIXED_ASSET: "5008", EXPENSE: "5016" };

export function paymentConcept(purchase: ExogenaPurchase): string {
  for (const w of purchase.withholdings) {
    if (w.type === "RETEFUENTE" && CONCEPT_BY_WITHHOLDING[w.conceptCode]) return CONCEPT_BY_WITHHOLDING[w.conceptCode]!;
  }
  return CONCEPT_BY_KIND[purchase.kind];
}

export interface Format1001Row extends ThirdPartyInfo {
  /** Null en pagos registrados como gasto (el beneficiario no es un proveedor). */
  supplierId: string | null;
  conceptoPago: string;
  /** Valor sin IVA: el IVA descontable va en el 1005, no aqui. */
  pagoDeducible: number;
  pagoNoDeducible: number;
  ivaMayorValorCostoDeducible: number;
  ivaMayorValorCostoNoDeducible: number;
  retencionRentaPracticada: number;
  retencionRentaAsumida: number;
  retencionIvaResponsables: number;
  retencionIvaNoDomiciliados: number;
}

/** Los pagos de nomina no van aqui (par. 12): van en el 2276. Las retenciones de ICA tampoco (no son renta ni IVA). */
/** Concepto 1001 de un gasto segun su categoria (las de fabrica de Contapro). */
const CONCEPT_BY_EXPENSE_CATEGORY: Record<string, string> = { ARRIENDO: "5005", HONORARIOS: "5002", SERVICIOS: "5004" };

function emptyRow(supplierId: string | null, third: ThirdPartyInfo, concept: string): Format1001Row {
  return {
    supplierId,
    ...third,
    conceptoPago: concept,
    pagoDeducible: 0,
    pagoNoDeducible: 0,
    ivaMayorValorCostoDeducible: 0,
    ivaMayorValorCostoNoDeducible: 0,
    retencionRentaPracticada: 0,
    retencionRentaAsumida: 0,
    retencionIvaResponsables: 0,
    retencionIvaNoDomiciliados: 0,
  };
}

/** Tercero de un gasto: identificado si se registro su documento; si no, "CUANTIAS MENORES". */
function expensePayee(e: ExogenaYearData["expenses"][number]): ThirdPartyInfo {
  if (!e.payeeDocumentNumber) return unidentified("CUANTIAS MENORES");
  return { documentType: e.payeeDocumentType ?? "NIT", documentNumber: e.payeeDocumentNumber, name: e.payeeName, municipalityCode: null, incompleto: true };
}

export function buildFormat1001(data: Pick<ExogenaYearData, "purchases" | "suppliers"> & Partial<Pick<ExogenaYearData, "expenses">>): Format1001Row[] {
  const suppliers = new Map(data.suppliers.map((s) => [s.id, s]));
  const rows = new Map<string, Format1001Row>();
  // Gastos: misma fila que una compra al mismo NIT y concepto. Sin documento van a cuantias menores.
  for (const e of data.expenses ?? []) {
    const concept = CONCEPT_BY_EXPENSE_CATEGORY[e.categoryCode] ?? "5016";
    const payee = expensePayee(e);
    const key = `${payee.documentNumber}|${concept}`;
    const row = rows.get(key) ?? emptyRow(null, payee, concept);
    row.pagoDeducible = round2(row.pagoDeducible + e.subtotal);
    rows.set(key, row);
  }
  for (const p of data.purchases) {
    const concept = paymentConcept(p);
    const supplierInfo = info(suppliers.get(p.supplierId), p.supplierId);
    const key = `${supplierInfo.documentNumber || p.supplierId}|${concept}`;
    const row = rows.get(key) ?? emptyRow(p.supplierId, supplierInfo, concept);
    // Si la fila la abrio un gasto, el proveedor (con municipio) completa los datos del tercero.
    if (row.supplierId === null) Object.assign(row, { supplierId: p.supplierId, ...supplierInfo });
    row.pagoDeducible = round2(row.pagoDeducible + p.subtotal);
    for (const w of p.withholdings) {
      if (w.type === "RETEFUENTE") row.retencionRentaPracticada = round2(row.retencionRentaPracticada + w.amount);
      if (w.type === "RETEIVA") row.retencionIvaResponsables = round2(row.retencionIvaResponsables + w.amount);
    }
    rows.set(key, row);
  }
  return [...rows.values()];
}

// ---------- 1005: IVA descontable ----------

export interface Format1005Row extends ThirdPartyInfo {
  thirdPartyId: string | null;
  ivaDescontable: number;
  /** IVA de devoluciones en ventas anuladas, rescindidas o resueltas (y notas credito). */
  ivaDevolucionesVentas: number;
}

/**
 * IVA descontable por proveedor (compras) e IVA de devoluciones en ventas por cliente (art.
 * 1.3.5.5.1). Las devoluciones de ventas a consumidor final van en un registro 222222222 "CONSUMIDOR
 * FINAL", tipo 43.
 */
export function buildFormat1005(data: ExogenaYearData): Format1005Row[] {
  const suppliers = new Map(data.suppliers.map((s) => [s.id, s]));
  const customers = new Map(data.customers.map((c) => [c.id, c]));
  const rows = new Map<string, Format1005Row>();
  const get = (key: string, make: () => Format1005Row) => {
    const row = rows.get(key) ?? make();
    rows.set(key, row);
    return row;
  };

  for (const e of data.expenses ?? []) {
    if (e.taxTotal <= 0) continue;
    const payee = expensePayee(e);
    const key = payee.documentNumber === UNIDENTIFIED_DOCUMENT_NUMBER ? "E|unidentified" : `D|${payee.documentNumber}`;
    const row = get(key, () => ({ thirdPartyId: null, ...payee, ivaDescontable: 0, ivaDevolucionesVentas: 0 }));
    row.ivaDescontable = round2(row.ivaDescontable + e.taxTotal);
  }
  for (const p of data.purchases) {
    if (p.taxTotal <= 0) continue;
    const supplierInfo = info(suppliers.get(p.supplierId), p.supplierId);
    const row = get(supplierInfo.documentNumber ? `D|${supplierInfo.documentNumber}` : `S|${p.supplierId}`, () => ({ thirdPartyId: p.supplierId, ...supplierInfo, ivaDescontable: 0, ivaDevolucionesVentas: 0 }));
    row.ivaDescontable = round2(row.ivaDescontable + p.taxTotal);
  }
  const refunds = [...data.returns, ...data.creditNotes].map((r) => ({ customerId: r.customerId, tax: r.tax }));
  for (const s of data.shiftCloses) if (s.returnsIva > 0) refunds.push({ customerId: null, tax: s.returnsIva });
  for (const r of refunds) {
    if (r.tax <= 0) continue;
    const row = r.customerId
      ? get(`C|${r.customerId}`, () => ({ thirdPartyId: r.customerId, ...info(customers.get(r.customerId!), r.customerId!), ivaDescontable: 0, ivaDevolucionesVentas: 0 }))
      : get(UNIDENTIFIED_KEY, () => ({ thirdPartyId: null, ...unidentified("CONSUMIDOR FINAL"), ivaDescontable: 0, ivaDevolucionesVentas: 0 }));
    row.ivaDevolucionesVentas = round2(row.ivaDevolucionesVentas + r.tax);
  }
  return [...rows.values()];
}

// ---------- 1006: IVA generado ----------

export interface Format1006Row extends ThirdPartyInfo {
  customerId: string | null;
  ivaGenerado: number;
  impuestoConsumo: number;
  /** IVA recuperado en devoluciones en compras: Contapro no tiene devoluciones a proveedores (0). */
  ivaRecuperadoDevolucionesCompras: number;
}

/** IVA generado e impuesto al consumo por cliente (art. 1.3.5.5.2); sin cliente: 222222222 "CUANTIAS MENORES". */
export function buildFormat1006(data: ExogenaYearData): Format1006Row[] {
  const customers = new Map(data.customers.map((c) => [c.id, c]));
  const rows = new Map<string, Format1006Row>();
  const addSigned = (customerId: string | null, iva: number, inc: number) => {
    if (iva === 0 && inc === 0) return;
    const key = customerId ?? UNIDENTIFIED_KEY;
    const row =
      rows.get(key) ??
      ({
        customerId,
        ...(customerId ? info(customers.get(customerId), customerId) : unidentified("CUANTIAS MENORES")),
        ivaGenerado: 0,
        impuestoConsumo: 0,
        ivaRecuperadoDevolucionesCompras: 0,
      } satisfies Format1006Row);
    row.ivaGenerado = round2(row.ivaGenerado + iva);
    row.impuestoConsumo = round2(row.impuestoConsumo + inc);
    rows.set(key, row);
  };
  const add = (customerId: string | null, iva: number, inc: number) => {
    if (iva > 0 || inc > 0) addSigned(customerId, iva, inc);
  };
  for (const s of data.sales) add(s.customerId, s.taxTotal, 0);
  for (const s of data.shiftCloses) add(null, s.iva, s.inc);
  for (const m of data.manualInvoices) {
    if (m.external && !m.customerId) continue; // ya esta en el cierre de turno
    add(m.customerId, m.ivaTotal, m.incTotal);
    // Factura de un POS externo con cliente: se identifica, y sale del total sin identificar del cierre.
    if (m.external) addSigned(null, -m.ivaTotal, -m.incTotal);
  }
  return [...rows.values()];
}

// ---------- 1007: ingresos recibidos ----------

/** 4001 = ingresos brutos de actividades ordinarias (art. 1.3.5.4.1). */
export const INCOME_CONCEPT_ORDINARY = "4001";

export interface Format1007Row extends ThirdPartyInfo {
  customerId: string | null;
  conceptoIngreso: string;
  valorIngreso: number;
  /** Devoluciones, rebajas y descuentos (descuentos de linea, devoluciones y notas credito). */
  devolucionesRebajasDescuentos: number;
}

/**
 * Ingresos brutos por cliente (art. 1.3.5.4.1): ventas del POS, facturas manuales y cierres de un POS
 * externo. Los ingresos sin adquirente identificado van en un registro 222222222 "CUANTIAS MENORES",
 * tipo 43 (antes se omitian, y la exogena quedaba por debajo de lo facturado).
 */
export function buildFormat1007(data: ExogenaYearData): Format1007Row[] {
  const customers = new Map(data.customers.map((c) => [c.id, c]));
  const rows = new Map<string, Format1007Row>();
  const add = (customerId: string | null, income: number, deductions: number) => {
    if (income === 0 && deductions === 0) return;
    const key = customerId ?? UNIDENTIFIED_KEY;
    const row =
      rows.get(key) ??
      ({
        customerId,
        ...(customerId ? info(customers.get(customerId), customerId) : unidentified("CUANTIAS MENORES")),
        conceptoIngreso: INCOME_CONCEPT_ORDINARY,
        valorIngreso: 0,
        devolucionesRebajasDescuentos: 0,
      } satisfies Format1007Row);
    row.valorIngreso = round2(row.valorIngreso + income);
    row.devolucionesRebajasDescuentos = round2(row.devolucionesRebajasDescuentos + deductions);
    rows.set(key, row);
  };
  for (const s of data.sales) add(s.customerId, s.subtotal, s.discountTotal);
  for (const s of data.shiftCloses) add(null, s.base, s.returnsBase);
  for (const m of data.manualInvoices) {
    if (m.external && !m.customerId) continue; // ya esta en el cierre de turno
    add(m.customerId, m.subtotal, 0);
    if (m.external) add(null, -m.subtotal, 0);
  }
  for (const r of data.returns) add(r.customerId, 0, r.base);
  for (const n of data.creditNotes) add(n.customerId, 0, n.base);
  return [...rows.values()];
}

// ---------- 2276: rentas de trabajo ----------

const SALARY_CODES = new Set(["SALARY", "COMMISSION", "OVERTIME_DAY", "OVERTIME_NIGHT", "NIGHT_SURCHARGE", "SUNDAY_SURCHARGE", "TRANSPORT_ALLOWANCE"]);
const OTHER_PAYMENT_CODES = new Set(["SICK_LEAVE_EMPLOYER", "SICK_LEAVE_EPS", "WORK_INJURY_ARL", "MATERNITY_LEAVE", "PATERNITY_LEAVE", "NON_SALARY_BONUS"]);

export interface Format2276Row {
  employeeId: string;
  documentType: string;
  documentNumber: string;
  firstSurname: string;
  secondSurname: string;
  firstName: string;
  otherNames: string;
  address: string;
  municipalityCode: string | null;
  pagosSalarios: number;
  pagosPrestacionesSociales: number;
  otrosPagos: number;
  cesantiasInteresesPagados: number;
  cesantiasConsignadasFondo: number;
  aportesSalud: number;
  aportesPensionFsp: number;
  retencionFuente: number;
}

/**
 * Pagos laborales del año por empleado, para el 2276 (los salarios no van en el 1001, par. 12 del art.
 * 1.3.5.2.1). Sale de las nominas aprobadas del año y de las liquidaciones de prestaciones:
 * - Salarios: salario, horas extra, recargos y auxilio de transporte.
 * - Prestaciones: vacaciones disfrutadas o compensadas y prima.
 * - Otros pagos: incapacidades, licencias e indemnizacion.
 * - Cesantias e intereses pagados al trabajador y cesantias consignadas al fondo, por separado.
 * La clasificacion de cada concepto en las columnas oficiales del formato es propia: revisar con el contador.
 */
export function buildFormat2276(data: ExogenaPayrollData): Format2276Row[] {
  const rows = new Map<string, Format2276Row>();
  const employees = new Map(data.employees.map((e) => [e.id, e]));
  const row = (employeeId: string) => {
    let r = rows.get(employeeId);
    if (!r) {
      const e = employees.get(employeeId);
      r = {
        employeeId,
        documentType: e?.documentType ?? "",
        documentNumber: e?.documentNumber ?? "",
        firstSurname: e?.lastName ?? "",
        secondSurname: e?.secondLastName ?? "",
        firstName: e?.firstName ?? "",
        otherNames: e?.middleName ?? "",
        address: e?.address ?? "",
        municipalityCode: data.workplaceMunicipalityCode,
        pagosSalarios: 0,
        pagosPrestacionesSociales: 0,
        otrosPagos: 0,
        cesantiasInteresesPagados: 0,
        cesantiasConsignadasFondo: 0,
        aportesSalud: 0,
        aportesPensionFsp: 0,
        retencionFuente: 0,
      };
      rows.set(employeeId, r);
    }
    return r;
  };

  for (const item of data.items) {
    const r = row(item.employeeId);
    if (SALARY_CODES.has(item.conceptCode)) r.pagosSalarios = round2(r.pagosSalarios + item.amount);
    else if (item.conceptCode === "VACATION_PAY") r.pagosPrestacionesSociales = round2(r.pagosPrestacionesSociales + item.amount);
    else if (OTHER_PAYMENT_CODES.has(item.conceptCode)) r.otrosPagos = round2(r.otrosPagos + item.amount);
    else if (item.conceptCode === "HEALTH_EMPLOYEE") r.aportesSalud = round2(r.aportesSalud + item.amount);
    else if (item.conceptCode === "PENSION_EMPLOYEE" || item.conceptCode === "SOLIDARITY_FUND") r.aportesPensionFsp = round2(r.aportesPensionFsp + item.amount);
    else if (item.conceptCode === "WITHHOLDING_TAX") r.retencionFuente = round2(r.retencionFuente + item.amount);
  }

  for (const s of data.settlements) {
    const r = row(s.employeeId);
    for (const line of s.lines) {
      if (line.concept === "SERVICE_BONUS" || line.concept === "VACATION") r.pagosPrestacionesSociales = round2(r.pagosPrestacionesSociales + line.amount);
      else if (line.concept === "INDEMNITY") r.otrosPagos = round2(r.otrosPagos + line.amount);
      else if (line.concept === "SEVERANCE_INTEREST") r.cesantiasInteresesPagados = round2(r.cesantiasInteresesPagados + line.amount);
      else if (line.concept === "SEVERANCE") {
        const toFund = Math.min(line.amount, s.toSeveranceFund);
        r.cesantiasConsignadasFondo = round2(r.cesantiasConsignadasFondo + toFund);
        r.cesantiasInteresesPagados = round2(r.cesantiasInteresesPagados + line.amount - toFund);
      }
    }
    r.retencionFuente = round2(r.retencionFuente + s.withholding);
  }
  return [...rows.values()];
}
