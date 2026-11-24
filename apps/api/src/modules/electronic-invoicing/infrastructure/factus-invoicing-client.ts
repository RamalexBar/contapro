import { env } from "../../../config/env";
import type {
  IThirdPartyInvoicingClient,
  ThirdPartyDocumentLineInput,
  ThirdPartyDocumentResult,
  ThirdPartyInvoiceInput,
  ThirdPartyInvoiceResult,
  ThirdPartyNoteInput,
  ThirdPartyPayrollInput,
  ThirdPartySupportDocumentInput,
} from "../domain/third-party-invoicing-client";
import { authenticateFactus, type FactusOAuthCredentials } from "./factus-auth";

/**
 * Integracion real con Factus API (https://www.factus.com.co, docs en developers.factus.com.co)
 * -- VERIFICADA contra su sandbox real el 2026-09-18: autenticacion OAuth2 exitosa y una factura
 * de prueba real (NIT sandbox 1000789002) fue creada y devuelta con `is_validated: true` y un
 * CUFE real -- y ademas verificada de punta a punta a traves de una venta real completada en
 * Contapro (ver README del modulo).
 *
 * Notas de arquitectura: (1) autenticacion es OAuth2 "password grant" (client_id + client_secret
 * + email + password -> access_token de 1h) -- este cliente se re-autentica en cada llamada en
 * vez de cachear/refrescar el token, mas simple a costa de una llamada HTTP extra por factura.
 * (2) Factus NO acepta el prefijo/resolucion/consecutivo de Contapro directamente -- exige un
 * `numbering_range_id` (id interno que Factus asigna al crear el rango de numeracion EN SU
 * plataforma, ver factus-account-provisioning.service.ts) y es Factus quien decide el numero
 * final del documento (`data.number`, ej. "SETP990019699") -- el `invoice.fullNumber` que
 * Contapro ya reservo localmente (via InvoiceNumberingResolution) queda solo como
 * `reference_code` de correlacion, no como el numero real del documento DIAN. Mismo aviso que ya
 * existe para el CUFE local provisional vs el real del proveedor (ver
 * domain/third-party-invoicing-client.ts). (3) el XML firmado NO viene en la respuesta de
 * creacion -- hay que pedirlo aparte con GET /v2/bills/{number}/download-xml.
 *
 * `numberingRangeId` viaja empaquetado junto a las 4 credenciales OAuth2 dentro del mismo blob
 * cifrado (`Company.factusCredentialsEncrypted`, ver set-electronic-invoicing-provider.use-case.ts)
 * porque el puerto `IThirdPartyInvoicingClient.submitInvoice` solo recibe un `apiToken: string` --
 * mas simple que ampliar la firma del puerto para un solo proveedor.
 *
 * Fijos: `document: "01"` (factura de venta), `operation_type: "10"` (estandar),
 * `unit_measure_code: "94"` (unidad), `standard_code: "999"`. Forma y medio de pago salen de los
 * pagos de la venta (ver buildPaymentDetails), y tributo/responsabilidades del comprador de
 * Customer.dianTaxRegimeId/dianTaxLevelId (por defecto "ZZ" y "R-99-PN"). Probado contra el sandbox
 * el 2026-10-17: pagos mixtos, credito con vencimiento, descuento por linea, ReteFuente y ReteIVA
 * por linea, y comprador con NIT, dv y responsabilidades.
 */

interface FactusCredentials extends FactusOAuthCredentials {
  numberingRangeId: number;
}

interface FactusBillResponse {
  status?: string;
  message?: string;
  data?: {
    number?: string;
    cufe?: string;
    is_validated?: boolean;
    reference_code?: string;
    errors?: Record<string, string>;
    totals?: { total?: string };
  };
  errors?: Record<string, string[]>;
}

interface FactusXmlResponse {
  status?: string;
  data?: {
    xml_base_64_encoded?: string;
  };
}

const DOCUMENT_TYPE_INVOICE = "01";
const OPERATION_TYPE_STANDARD = "10";
const PAYMENT_FORM_CASH = "1";
const PAYMENT_FORM_CREDIT = "2";
/** Factura sin pagos informados (manual, API publica): consignacion, el valor de antes. */
const PAYMENT_METHOD_UNSPECIFIED_CASH = "42";
/** Medio de la parte a credito: "1" = medio de pago no definido (aceptado por el sandbox). */
const PAYMENT_METHOD_CREDIT = "1";
/** DIAN: 10 efectivo, 48 tarjeta credito (Contapro no distingue credito/debito), 47 transferencia, ZZZ otro. */
const PAYMENT_METHOD_CODE: Record<string, string> = { CASH: "10", CARD: "48", TRANSFER: "47", MIXED: "ZZZ" };
/** DIAN: 05 ReteIVA (tasa sobre el IVA), 06 ReteRenta, 07 ReteICA. */
const WITHHOLDING_CODE: Record<string, string> = { RETEIVA: "05", RETEFUENTE: "06", RETEICA: "07" };
const DEFAULT_CREDIT_DAYS = 30;
const UNIT_MEASURE_UNIT = "94";
const STANDARD_CODE_TAXPAYER_ADOPTED = "999";
const TAX_CODE_IVA = "01";
// Codigo DIAN del impuesto nacional al consumo (restaurantes, bares). NO verificado contra el
// sandbox de Factus (agregado 2026-10-13 sin credenciales) -- mismo aviso que el resto del cliente.
const TAX_CODE_INC = "04";
const GENERIC_TRIBUTE_CODE = "ZZ";
const GENERIC_RESPONSIBILITY = "R-99-PN";

/** DIAN: 13=Cedula ciudadania, 22=Cedula extranjeria, 31=NIT, 41=Pasaporte. */
const DOCUMENT_TYPE_CODE: Record<string, string> = { CC: "13", CE: "22", NIT: "31", PASSPORT: "41" };
/** DIAN: 1=Persona Juridica, 2=Persona Natural. */
function legalOrganizationCode(documentType: string): string {
  return documentType === "NIT" ? "1" : "2";
}

function money(value: number): string {
  return value.toFixed(2);
}

function dateOnly(date: Date): string {
  return date.toISOString().slice(0, 10);
}

/** Digito de verificacion del NIT (algoritmo DIAN, modulo 11). */
export function nitCheckDigit(nit: string): string {
  const weights = [3, 7, 13, 17, 19, 23, 29, 37, 41, 43, 47, 53, 59, 67, 71];
  const digits = nit.replace(/\D/g, "").split("").reverse();
  const sum = digits.reduce((acc, d, i) => acc + Number(d) * (weights[i] ?? 0), 0);
  const r = sum % 11;
  return String(r > 1 ? 11 - r : r);
}

/** "900123456-8" o "900123456" -> numero sin dv + dv (el escrito, o calculado). */
export function splitNit(documentNumber: string): { identification: string; dv: string } {
  const [base = "", written] = documentNumber.replace(/[^\d-]/g, "").split("-");
  return { identification: base, dv: written && /^\d$/.test(written) ? written : nitCheckDigit(base) };
}

const cents = (value: number) => Math.round(value * 100);

/**
 * payment_details: Factus exige que sumen el total de la factura (antes de retenciones). Los pagos
 * de la venta pueden no sumar eso: el vuelto del efectivo sobra y lo retenido no lo paga nadie. Se
 * ajusta en centavos: el sobrante se quita primero del efectivo y lo faltante se suma al ultimo pago.
 * La parte CREDIT va como forma "2" con su vencimiento.
 */
export function buildPaymentDetails(input: ThirdPartyInvoiceInput, referenceCode: string): Record<string, string>[] {
  const totalCents = cents(input.total);
  const issueDay = dateOnly(input.issueDate);
  const payments = (input.payments ?? []).filter((p) => p.amount > 0);
  if (payments.length === 0) {
    return [
      { payment_form: PAYMENT_FORM_CASH, payment_method_code: PAYMENT_METHOD_UNSPECIFIED_CASH, reference_code: `${referenceCode}-pago`, amount: money(input.total), due_date: issueDay },
    ];
  }

  const creditCents = Math.min(cents(payments.filter((p) => p.method === "CREDIT").reduce((s, p) => s + p.amount, 0)), totalCents);
  const others = payments.filter((p) => p.method !== "CREDIT").map((p) => ({ method: p.method, cents: cents(p.amount) }));

  // Sobra (vuelto): se descuenta del efectivo primero, despues de los demas desde el ultimo.
  let excess = others.reduce((s, p) => s + p.cents, 0) + creditCents - totalCents;
  const trimOrder = [...others.filter((p) => p.method === "CASH"), ...others.filter((p) => p.method !== "CASH").reverse()];
  for (const p of trimOrder) {
    if (excess <= 0) break;
    const cut = Math.min(p.cents, excess);
    p.cents -= cut;
    excess -= cut;
  }

  const details = others
    .filter((p) => p.cents > 0)
    .map((p) => ({ form: PAYMENT_FORM_CASH, method: PAYMENT_METHOD_CODE[p.method] ?? "ZZZ", cents: p.cents, dueDate: issueDay }));
  if (creditCents > 0) {
    const due = input.dueDate ?? new Date(input.issueDate.getTime() + DEFAULT_CREDIT_DAYS * 86_400_000);
    details.push({ form: PAYMENT_FORM_CREDIT, method: PAYMENT_METHOD_CREDIT, cents: creditCents, dueDate: dateOnly(due) });
  }
  // Falta (retenciones): se completa en el ultimo pago para que sumen el total.
  const missing = totalCents - details.reduce((s, d) => s + d.cents, 0);
  if (missing > 0) {
    if (details.length === 0) details.push({ form: PAYMENT_FORM_CASH, method: PAYMENT_METHOD_UNSPECIFIED_CASH, cents: 0, dueDate: issueDay });
    details[details.length - 1]!.cents += missing;
  }

  return details.map((d, i) => ({
    payment_form: d.form,
    payment_method_code: d.method,
    reference_code: `${referenceCode}-pago${i + 1}`,
    amount: (d.cents / 100).toFixed(2),
    due_date: d.dueDate,
  }));
}

function buildCustomer(customer: ThirdPartyInvoiceInput["customer"]): Record<string, unknown> {
  const documentType = customer.documentType.trim().toUpperCase();
  const nit = documentType === "NIT" ? splitNit(customer.documentNumber) : null;
  const responsibilities = (customer.taxLevelId ?? "")
    .split(",")
    .map((r) => r.trim().toUpperCase())
    .filter((r) => /^[OR]-\d/.test(r));

  return {
    identification_document_code: DOCUMENT_TYPE_CODE[documentType] ?? DOCUMENT_TYPE_CODE.CC,
    identification: nit ? nit.identification : customer.documentNumber,
    ...(nit ? { dv: nit.dv, company: customer.name } : {}),
    names: customer.name,
    address: customer.address ?? "No informado",
    email: customer.email ?? undefined,
    phone: customer.phone ?? undefined,
    legal_organization_code: legalOrganizationCode(documentType),
    tribute_code: customer.taxRegimeId === TAX_CODE_IVA ? TAX_CODE_IVA : GENERIC_TRIBUTE_CODE,
    country_code: "CO",
    responsibilities: responsibilities.length > 0 ? responsibilities : [GENERIC_RESPONSIBILITY],
    municipality_code: customer.cityId ?? undefined,
  };
}

/**
 * Factus no crea un documento nuevo si el reference_code ya existe: devuelve el anterior como
 * validado. Prefijo+numero solo puede repetirse (resolucion nueva que reinicia la numeracion, o el
 * sandbox compartido, donde otros usuarios ya usaron "SETP18"), asi que se le suma la fecha de
 * emision. Es estable para la misma factura, y un reenvio sigue devolviendo el mismo documento.
 */
export function factusReferenceCode(input: Pick<ThirdPartyInvoiceInput, "prefix" | "documentNumber" | "issueDate">): string {
  return `${input.prefix}${input.documentNumber}-${input.issueDate.getTime().toString(36)}`;
}

/**
 * Factus exige "taxes" en cada linea, tambien sin impuesto (una lista vacia la rechaza: "El campo
 * items.0.taxes es obligatorio", sandbox 2026-11-04). Sin impuesto: exento = IVA al 0 %; cualquier
 * otro caso (excluido, o emisor no responsable de IVA) va como excluido, segun el ejemplo
 * "impuesto excluido" de developers.factus.com.co.
 */
function lineTaxes(line: ThirdPartyInvoiceInput["lines"][number]): Record<string, unknown>[] {
  if (line.taxAmount > 0) return [{ code: line.taxType === "INC" ? TAX_CODE_INC : TAX_CODE_IVA, rate: line.taxPercent.toFixed(2) }];
  if (line.taxType === "EXEMPT") return [{ code: TAX_CODE_IVA, rate: "0.00" }];
  return [{ is_excluded: true }];
}

export function buildBillPayload(input: ThirdPartyInvoiceInput, numberingRangeId: number): Record<string, unknown> {
  const customer = input.customer;
  const referenceCode = factusReferenceCode(input);

  return {
    reference_code: referenceCode,
    document: DOCUMENT_TYPE_INVOICE,
    numbering_range_id: numberingRangeId,
    operation_type: OPERATION_TYPE_STANDARD,
    // Factus le envia al comprador el XML y el PDF por correo (lo que exige la DIAN); Contapro no
    // envia la factura por correo, solo por WhatsApp.
    send_email: Boolean(customer.email),
    cash_rounding_amount: "0.00",
    payment_details: buildPaymentDetails(input, referenceCode),
    customer: buildCustomer(customer),
    items: input.lines.map((line) => {
      const hasIva = line.taxAmount > 0 && line.taxType !== "INC";
      // Cada retencion de la venta se aplica a todas las lineas (ReteIVA solo a las que tienen IVA).
      const withholdings = (input.withholdings ?? [])
        .filter((w) => w.ratePercent > 0 && WITHHOLDING_CODE[w.type] && (w.type !== "RETEIVA" || hasIva))
        .map((w) => ({ code: WITHHOLDING_CODE[w.type], rate: w.ratePercent.toFixed(2) }));
      return {
        code_reference: line.code,
        name: line.description,
        quantity: line.quantity.toFixed(2),
        discount_rate: (line.discountPercent ?? 0).toFixed(2),
        price: money(line.unitPrice),
        unit_measure_code: UNIT_MEASURE_UNIT,
        standard_code: STANDARD_CODE_TAXPAYER_ADOPTED,
        taxes: lineTaxes(line),
        ...(withholdings.length > 0 ? { withholding_taxes: withholdings } : {}),
      };
    }),
  };
}

/** Codigos de documento de los rangos de numeracion de Factus. */
const RANGE_DOCUMENT_CODE = { CREDIT: "22", DEBIT: "23", SUPPORT: "24" } as const;
const NOTE_CUSTOMIZATION_WITH_INVOICE = { CREDIT: "20", DEBIT: "30" } as const;
const NOTE_PATH = { CREDIT: "credit-notes", DEBIT: "debit-notes" } as const;
const NOTE_LABEL = { CREDIT: "notas credito", DEBIT: "notas debito", SUPPORT: "documento soporte" } as const;

/** Impuesto de un renglon de nota: IVA o INC con tarifa, exento = IVA 0 %, el resto excluido. */
function documentLineTaxes(line: ThirdPartyDocumentLineInput): Record<string, unknown>[] {
  if (line.taxPercent > 0) return [{ code: line.taxType === "INC" ? TAX_CODE_INC : TAX_CODE_IVA, rate: line.taxPercent.toFixed(2) }];
  if (line.taxType === "EXEMPT") return [{ code: TAX_CODE_IVA, rate: "0.00" }];
  return [{ is_excluded: true }];
}

function documentLine(line: ThirdPartyDocumentLineInput): Record<string, unknown> {
  return {
    code_reference: line.code,
    name: line.description,
    quantity: line.quantity.toFixed(2),
    discount_rate: (line.discountPercent ?? 0).toFixed(2),
    price: money(line.unitPrice),
    unit_measure_code: UNIT_MEASURE_UNIT,
    standard_code: STANDARD_CODE_TAXPAYER_ADOPTED,
  };
}

/**
 * Nota credito (POST /v2/credit-notes/validate) o debito (POST /v2/debit-notes/validate) que
 * referencia una factura de Factus por su numero (bill_number). Verificado en el sandbox el
 * 2026-11-24: la nota debito exige customer aunque la documentacion diga que es opcional.
 */
export function buildNotePayload(input: ThirdPartyNoteInput, numberingRangeId: number): Record<string, unknown> {
  return {
    reference_code: input.referenceCode,
    correction_concept_code: input.conceptCode,
    customization_id: NOTE_CUSTOMIZATION_WITH_INVOICE[input.kind],
    bill_number: input.billNumber,
    numbering_range_id: numberingRangeId,
    observation: input.observation.slice(0, 500),
    ...(input.kind === "DEBIT" ? { send_email: Boolean(input.customer.email) } : {}),
    payment_details: [
      {
        payment_form: PAYMENT_FORM_CASH,
        payment_method_code: input.paymentMethodCode ?? PAYMENT_METHOD_CODE.CASH,
        reference_code: `${input.referenceCode}-pago`,
        amount: money(input.total),
      },
    ],
    customer: buildCustomer(input.customer),
    items: input.lines.map((line) => ({ ...documentLine(line), taxes: documentLineTaxes(line) })),
  };
}

/**
 * Documento soporte (POST /v2/support-documents/validate). Reglas del sandbox (2026-11-24): el
 * proveedor residente en Colombia va siempre con tipo 31 (NIT; el de una persona natural es su
 * cedula) y un digito de verificacion valido; los impuestos solo admiten el codigo 01 (IVA).
 */
export function buildSupportDocumentPayload(input: ThirdPartySupportDocumentInput, numberingRangeId: number): Record<string, unknown> {
  const provider = input.provider;
  const { identification, dv } = splitNit(provider.documentNumber);
  // Los NIT de personas juridicas tienen 9 digitos y empiezan por 8 o 9; el de una persona natural
  // es su cedula, asi que un "NIT" con otra forma se trata como persona natural.
  const isCompany = provider.documentType.trim().toUpperCase() === "NIT" && /^[89]\d{8}$/.test(identification);

  const totalCents = cents(input.total);
  const creditCents = Math.min(cents(input.creditAmount ?? 0), totalCents);
  const payments: Record<string, string>[] = [];
  if (totalCents - creditCents > 0) {
    payments.push({ payment_form: PAYMENT_FORM_CASH, payment_method_code: PAYMENT_METHOD_CODE.CASH, amount: ((totalCents - creditCents) / 100).toFixed(2) });
  }
  if (creditCents > 0) {
    const due = input.dueDate ?? new Date(input.issueDate.getTime() + DEFAULT_CREDIT_DAYS * 86_400_000);
    payments.push({ payment_form: PAYMENT_FORM_CREDIT, payment_method_code: PAYMENT_METHOD_CREDIT, amount: (creditCents / 100).toFixed(2), due_date: dateOnly(due) });
  }

  return {
    reference_code: input.referenceCode,
    numbering_range_id: numberingRangeId,
    observation: input.observation.slice(0, 500),
    payment_details: payments.map((p, i) => ({ ...p, reference_code: `${input.referenceCode}-pago${i + 1}` })),
    provider: {
      identification_document_code: DOCUMENT_TYPE_CODE.NIT,
      identification,
      dv,
      names: provider.name,
      ...(isCompany ? { company: provider.name } : {}),
      legal_organization_code: isCompany ? "1" : "2",
      address: provider.address ?? "No informado",
      email: provider.email ?? undefined,
      phone: provider.phone ?? undefined,
      country_code: "CO",
      municipality_code: provider.municipalityCode ?? undefined,
    },
    items: input.lines.map((line) => {
      const withholdings = input.withholdings
        .filter((w) => w.ratePercent > 0 && WITHHOLDING_CODE[w.type] && (w.type !== "RETEIVA" || line.taxPercent > 0))
        .map((w) => ({ code: WITHHOLDING_CODE[w.type], rate: w.ratePercent.toFixed(2) }));
      return {
        ...documentLine(line),
        taxes: line.taxPercent > 0 ? [{ code: TAX_CODE_IVA, rate: line.taxPercent.toFixed(2) }] : [{ code: TAX_CODE_IVA, rate: "0.00", is_excluded: true }],
        ...(withholdings.length > 0 ? { withholding_taxes: withholdings } : {}),
      };
    }),
  };
}

/** Tipos de documento del trabajador en la nomina electronica (tabla de Factus/DIAN). */
const PAYROLL_DOCUMENT_CODE: Record<string, string> = { RC: "11", TI: "12", CC: "13", TE: "21", CE: "22", NIT: "31", PASSPORT: "41", PA: "41", PEP: "47" };
const PAYROLL_PERIOD_CODE = { BIWEEKLY: "4", MONTHLY: "5" } as const;

const sumBy = (items: ThirdPartyPayrollInput["items"], codes: string[]) => {
  const matched = items.filter((i) => codes.includes(i.conceptCode));
  return {
    amount: Math.round(matched.reduce((s, i) => s + i.amount, 0) * 100) / 100,
    quantity: matched.reduce((s, i) => s + (i.quantity ?? 0), 0),
    rate: matched.find((i) => i.rate !== null && i.rate !== undefined)?.rate ?? null,
  };
};

/**
 * Porcentaje de una hora extra o recargo. Las extras guardan el valor de la hora ordinaria en `rate`
 * (valor = horas x hora x (1 + %)); el recargo nocturno, valor = horas x hora x %; el dominical guarda
 * el % directamente (ver payroll-calculator.ts).
 */
function hourPercentage(conceptCode: string, total: { amount: number; quantity: number; rate: number | null }): number {
  if (conceptCode === "SUNDAY_SURCHARGE") return total.rate ?? 0;
  if (!total.rate || total.quantity <= 0) return 0;
  const factor = total.amount / (total.quantity * total.rate);
  return Math.round((conceptCode === "NIGHT_SURCHARGE" ? factor : factor - 1) * 10000) / 100;
}

/** Horas extra y recargos: codigos de la tabla de Factus (1 HED, 2 HEN, 3 RN, 5 recargo dominical/festivo). */
const HOUR_TYPE_CODE: Record<string, string> = { OVERTIME_DAY: "1", OVERTIME_NIGHT: "2", NIGHT_SURCHARGE: "3", SUNDAY_SURCHARGE: "5" };

/**
 * Nomina electronica (POST /v2/payrolls). Un documento por empleado por mes: en nomina quincenal las
 * dos quincenas llegan sumadas y `payment_dates` lleva las dos fechas de pago. Factus calcula los
 * totales; el neto se compara despues con el de Contapro.
 *
 * NO VERIFICADO contra el sandbox (2026-11-24): la cuenta compartida de Factus responde "La empresa
 * no tiene habilitada la creacion de este documento" a cualquier solicitud, antes de validar los
 * campos. Armado siguiendo developers.factus.com.co/nomina/crear-y-validar y descripcion-de-campos.
 */
export function buildPayrollPayload(input: ThirdPartyPayrollInput, numberingRangeId: string): Record<string, unknown> {
  const items = input.items;
  const w = input.worker;
  const accruals: Record<string, unknown> = { suel: { amount: money(sumBy(items, ["SALARY"]).amount) } };

  const transport = sumBy(items, ["TRANSPORT_ALLOWANCE"]);
  if (transport.amount > 0) accruals.tra = [{ amount: money(transport.amount), accrual_type_code: "1" }];

  const hours = Object.entries(HOUR_TYPE_CODE)
    .map(([code, type]) => ({ code, type, total: sumBy(items, [code]) }))
    .filter((h) => h.total.amount > 0)
    .map((h) => ({
      quantity: h.total.quantity.toFixed(2),
      percentage: hourPercentage(h.code, h.total).toFixed(2),
      amount: money(h.total.amount),
      accrual_type_code: h.type,
    }));
  if (hours.length > 0) accruals.hora = hours;

  const vacation = sumBy(items, ["VACATION_PAY"]);
  if (vacation.amount > 0) accruals.vaca = [{ quantity: Math.round(vacation.quantity), amount: money(vacation.amount), accrual_type_code: "1" }];

  const incapacities = [
    { total: sumBy(items, ["SICK_LEAVE_EMPLOYER", "SICK_LEAVE_EPS"]), type: "1" }, // comun
    { total: sumBy(items, ["WORK_INJURY_ARL"]), type: "3" }, // laboral
  ]
    .filter((x) => x.total.amount > 0)
    .map((x) => ({ quantity: Math.round(x.total.quantity), amount: money(x.total.amount), accrual_type_code: x.type }));
  if (incapacities.length > 0) accruals.inca = incapacities;

  const licenses: Record<string, unknown>[] = [];
  for (const code of ["MATERNITY_LEAVE", "PATERNITY_LEAVE"]) {
    const t = sumBy(items, [code]);
    if (t.amount > 0) licenses.push({ quantity: Math.round(t.quantity), amount: money(t.amount), accrual_type_code: "1" });
  }
  const unpaid = sumBy(items, ["UNPAID_LEAVE"]);
  if (unpaid.quantity > 0) licenses.push({ quantity: Math.round(unpaid.quantity), accrual_type_code: "3" });
  if (licenses.length > 0) accruals.lice = licenses;

  const health = sumBy(items, ["HEALTH_EMPLOYEE"]);
  const pension = sumBy(items, ["PENSION_EMPLOYEE"]);
  const deductions: Record<string, unknown> = {
    salu: { percentage: (health.rate ?? 4).toFixed(2), amount: money(health.amount) },
    pens: { percentage: (pension.rate ?? 4).toFixed(2), amount: money(pension.amount) },
  };
  const fsp = sumBy(items, ["SOLIDARITY_FUND"]);
  if (fsp.amount > 0) deductions.dedu = [{ percentage: (fsp.rate ?? 1).toFixed(2), amount: money(fsp.amount), deduction_type_code: "1" }];
  const withholding = sumBy(items, ["WITHHOLDING_TAX"]);
  if (withholding.amount > 0) deductions.rete = { amount: money(withholding.amount) };
  const loans = items.filter((i) => i.conceptCode === "LOAN_DEDUCTION" && i.amount > 0);
  if (loans.length > 0) deductions.libr = loans.map((l) => ({ amount: money(l.amount), description: l.description || "Libranza" }));
  const garnishments = items.filter((i) => i.conceptCode === "GARNISHMENT" && i.amount > 0);
  if (garnishments.length > 0) deductions.otra = garnishments.map((g) => ({ amount: money(g.amount) }));

  const transfer = input.payment.method === "TRANSFER" && input.payment.accountNumber;
  return {
    reference_code: input.referenceCode,
    numbering_range_id: numberingRangeId,
    settlement_period: { month: String(input.month), year: String(input.year), payroll_period_code: PAYROLL_PERIOD_CODE[input.periodicity] },
    payment: {
      payment_method_code: transfer ? PAYMENT_METHOD_CODE.TRANSFER : PAYMENT_METHOD_CODE.CASH,
      ...(transfer ? { bank_name: input.payment.bankName ?? "No informado", account_type: "2", account_number: input.payment.accountNumber } : {}),
      payment_dates: input.paymentDates.map(dateOnly),
    },
    worker: {
      identification_document_code: PAYROLL_DOCUMENT_CODE[w.documentType.trim().toUpperCase()] ?? PAYROLL_DOCUMENT_CODE.CC,
      identification_number: w.documentNumber,
      first_name: w.firstName,
      ...(w.otherNames ? { other_names: w.otherNames } : {}),
      first_surname: w.firstSurname,
      ...(w.secondSurname ? { second_surname: w.secondSurname } : {}),
      address: w.address,
      country_code: "CO",
      municipality_code: w.municipalityCode,
      has_integral_salary: w.integralSalary,
      has_high_risk: false,
      worker_type_code: w.workerTypeCode,
      worker_subtype: w.workerSubtypeCode,
      contract_type: w.contractTypeCode,
      employee_code: w.employeeCode,
      salary: money(w.salary),
      entry_date: dateOnly(w.entryDate),
      days_worked: Math.round(w.daysWorked),
      ...(w.retirementDate ? { retirement_date: dateOnly(w.retirementDate) } : {}),
    },
    accruals,
    deductions,
  };
}

interface FactusDocumentResponse {
  status?: string;
  message?: string;
  data?: {
    number?: string;
    cude?: string;
    cuds?: string;
    cune?: string;
    is_validated?: boolean;
    totals?: { total?: string };
    /** Nomina: neto a pagar que calcula Factus. */
    net_balance?: string;
    errors?: Record<string, string> | string[];
  };
  errors?: Record<string, string[]>;
}

/** Interpreta la respuesta de crear una nota o documento soporte. Exportada para las pruebas. */
export function parseDocumentResponse(httpStatus: number, rawResponse: string, expectedTotal: number): ThirdPartyDocumentResult {
  if (httpStatus === 401 || httpStatus === 403 || httpStatus >= 500) {
    throw new Error(`Factus respondio ${httpStatus}: ${rawResponse.slice(0, 500)}`);
  }
  let parsed: FactusDocumentResponse;
  try {
    parsed = JSON.parse(rawResponse) as FactusDocumentResponse;
  } catch {
    throw new Error(`Factus devolvio una respuesta no-JSON (status ${httpStatus}): ${rawResponse.slice(0, 500)}`);
  }

  const data = parsed.data;
  const uniqueCode = data?.cude ?? data?.cuds ?? data?.cune ?? "";
  if (httpStatus === 201 && data?.is_validated && data.number && uniqueCode) {
    // Un reference_code repetido devuelve el documento anterior: si el total no cuadra, no es este.
    const reported = data.totals?.total ?? data.net_balance;
    const returnedTotal = Number(reported);
    if (reported !== undefined && Math.abs(returnedTotal - expectedTotal) > 1) {
      throw new Error(`Factus devolvio otro documento (${data.number}, total ${returnedTotal}) en vez de crear este (total ${expectedTotal})`);
    }
    return { status: "ACCEPTED", number: data.number, uniqueCode, signedXmlContent: "", rawResponse };
  }

  // En un rechazo, el detalle por campo viene en errors (objeto); en un documento validado,
  // data.errors es la lista de notificaciones de la DIAN, que no son el motivo del rechazo.
  const fieldErrors = parsed.errors ?? (data?.errors && !Array.isArray(data.errors) ? data.errors : undefined);
  const details = fieldErrors ? Object.values(fieldErrors).flat().join(" ") : "";
  const rejectionReason = [parsed.message, details].filter(Boolean).join(": ") || `Respuesta inesperada de Factus (status ${httpStatus})`;
  return { status: "REJECTED", number: data?.number ?? "", uniqueCode, signedXmlContent: "", rejectionReason, rawResponse };
}

/** "Nómina" (no "Nota de Ajuste Nómina"), sin importar las tildes. */
export function isPayrollRange(document: string | undefined): boolean {
  return (document ?? "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim().toLowerCase() === "nomina";
}

export class FactusInvoicingClient implements IThirdPartyInvoicingClient {
  async submitNote(credentialsJson: string, input: ThirdPartyNoteInput): Promise<ThirdPartyDocumentResult> {
    const credentials: FactusCredentials = JSON.parse(credentialsJson);
    const accessToken = await authenticateFactus(credentials);
    const rangeId = await this.activeRangeId(accessToken, input.kind);
    const path = NOTE_PATH[input.kind];
    return this.createDocument(accessToken, path, buildNotePayload(input, rangeId), input.total);
  }

  async submitSupportDocument(credentialsJson: string, input: ThirdPartySupportDocumentInput): Promise<ThirdPartyDocumentResult> {
    const credentials: FactusCredentials = JSON.parse(credentialsJson);
    const accessToken = await authenticateFactus(credentials);
    const rangeId = await this.activeRangeId(accessToken, "SUPPORT");
    return this.createDocument(accessToken, "support-documents", buildSupportDocumentPayload(input, rangeId), input.total);
  }

  async submitPayroll(credentialsJson: string, input: ThirdPartyPayrollInput): Promise<ThirdPartyDocumentResult> {
    const credentials: FactusCredentials = JSON.parse(credentialsJson);
    const accessToken = await authenticateFactus(credentials);
    const rangeId = await this.activePayrollRangeId(accessToken);
    // A diferencia de los demas documentos, la nomina se crea en /v2/payrolls (sin /validate).
    const res = await fetch(`${env.FACTUS_BASE_URL}/v2/payrolls`, {
      method: "POST",
      headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify(buildPayrollPayload(input, rangeId)),
    });
    const raw = await res.text();
    // 403 "La empresa no tiene habilitada la creacion de este documento": la cuenta de Factus no tiene
    // nomina activa. Es un rechazo con un motivo claro, no una falla de conexion.
    if (res.status === 403) {
      return { status: "REJECTED", number: "", uniqueCode: "", signedXmlContent: "", rejectionReason: `Factus: ${raw.slice(0, 300)}`, rawResponse: raw };
    }
    const result = parseDocumentResponse(res.status, raw, input.netPay);
    if (result.status !== "ACCEPTED") return result;
    return { ...result, signedXmlContent: await this.downloadXml(accessToken, "payrolls", result.number) };
  }

  /** Rangos de nomina: endpoint propio con ids de texto; se usa el primero activo de tipo "Nomina". */
  private async activePayrollRangeId(accessToken: string): Promise<string> {
    const res = await fetch(`${env.FACTUS_BASE_URL}/v2/numbering-ranges/payrolls?filter%5Bis_enabled%5D=true`, {
      headers: { Authorization: `Bearer ${accessToken}`, Accept: "application/json" },
    });
    const raw = await res.text();
    if (!res.ok) throw new Error(`Factus respondio ${res.status} al consultar los rangos de nomina: ${raw.slice(0, 300)}`);
    let ranges: { id?: string; document?: string; is_active?: boolean | number }[] = [];
    try {
      ranges = (JSON.parse(raw) as { data?: { data?: typeof ranges } }).data?.data ?? [];
    } catch {
      throw new Error(`Factus devolvio una respuesta no-JSON al consultar los rangos de nomina: ${raw.slice(0, 300)}`);
    }
    const active = ranges.find((r) => r.id && Boolean(r.is_active) && isPayrollRange(r.document));
    if (!active?.id) throw new Error("La cuenta de Factus no tiene un rango de numeracion activo para nomina. Creelo en el panel de Factus.");
    return active.id;
  }

  /**
   * El rango activo del tipo de documento en la cuenta de Factus de la empresa. Las notas no tienen
   * resolucion DIAN (el rango se crea con solo un prefijo); el documento soporte si.
   */
  private async activeRangeId(accessToken: string, kind: keyof typeof RANGE_DOCUMENT_CODE): Promise<number> {
    const res = await fetch(`${env.FACTUS_BASE_URL}/v2/numbering-ranges?filter%5Bdocument%5D=${RANGE_DOCUMENT_CODE[kind]}`, {
      headers: { Authorization: `Bearer ${accessToken}`, Accept: "application/json" },
    });
    const raw = await res.text();
    if (!res.ok) throw new Error(`Factus respondio ${res.status} al consultar los rangos de numeracion: ${raw.slice(0, 300)}`);
    let ranges: { id?: number; is_active?: boolean; is_expired?: boolean }[] = [];
    try {
      ranges = (JSON.parse(raw) as { data?: { data?: typeof ranges } }).data?.data ?? [];
    } catch {
      throw new Error(`Factus devolvio una respuesta no-JSON al consultar los rangos de numeracion: ${raw.slice(0, 300)}`);
    }
    const active = ranges.find((r) => r.id && r.is_active && !r.is_expired);
    if (!active?.id) {
      throw new Error(`La cuenta de Factus no tiene un rango de numeracion activo para ${NOTE_LABEL[kind]}. Creelo en el panel de Factus.`);
    }
    return active.id;
  }

  private async createDocument(accessToken: string, path: string, body: Record<string, unknown>, expectedTotal: number): Promise<ThirdPartyDocumentResult> {
    const res = await fetch(`${env.FACTUS_BASE_URL}/v2/${path}/validate`, {
      method: "POST",
      headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify(body),
    });
    const result = parseDocumentResponse(res.status, await res.text(), expectedTotal);
    if (result.status !== "ACCEPTED") return result;
    // Igual que en la factura: si la descarga del XML falla, el documento ya quedo emitido.
    return { ...result, signedXmlContent: await this.downloadXml(accessToken, path, result.number) };
  }

  private async downloadXml(accessToken: string, path: string, documentNumber: string): Promise<string> {
    const res = await fetch(`${env.FACTUS_BASE_URL}/v2/${path}/${documentNumber}/download-xml`, {
      headers: { Authorization: `Bearer ${accessToken}`, Accept: "application/json" },
    });
    if (!res.ok) return "";
    try {
      const base64 = (JSON.parse(await res.text()) as FactusXmlResponse).data?.xml_base_64_encoded;
      return base64 ? Buffer.from(base64, "base64").toString("utf-8") : "";
    } catch {
      return "";
    }
  }

  async submitInvoice(credentialsJson: string, input: ThirdPartyInvoiceInput): Promise<ThirdPartyInvoiceResult> {
    const credentials: FactusCredentials = JSON.parse(credentialsJson);

    const accessToken = await authenticateFactus(credentials);
    const billResult = await this.createBill(accessToken, input, credentials.numberingRangeId);

    if (billResult.status !== "ACCEPTED") {
      return billResult;
    }

    // El XML firmado no viene en la respuesta de creacion -- se pide aparte. Si esta segunda
    // llamada falla, la factura ya quedo creada/autorizada en Factus (irreversible), asi que se
    // devuelve igual como ACCEPTED con el XML vacio en vez de perder el CUFE ya emitido -- el
    // reenvio manual no vuelve a crear el documento (Factus lo rechazaria por reference_code
    // duplicado), asi que este hueco queda documentado como limite conocido, no auto-reintentado.
    const signedXmlContent = await this.downloadSignedXml(accessToken, billResult.rawResponse);

    return { ...billResult, signedXmlContent };
  }

  private async createBill(
    accessToken: string,
    input: ThirdPartyInvoiceInput,
    numberingRangeId: number
  ): Promise<ThirdPartyInvoiceResult & { status: "ACCEPTED" | "REJECTED" }> {
    const body = buildBillPayload(input, numberingRangeId);

    const res = await fetch(`${env.FACTUS_BASE_URL}/v2/bills/validate`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify(body),
    });

    const rawResponse = await res.text();

    // Fallas de transporte/autenticacion (token invalido, 5xx, timeout): no son un rechazo de
    // negocio, se propagan como excepcion en vez de disfrazarse de REJECTED.
    if (res.status === 401 || res.status === 403 || res.status >= 500) {
      throw new Error(`Factus respondio ${res.status}: ${rawResponse.slice(0, 500)}`);
    }

    let parsed: FactusBillResponse;
    try {
      parsed = JSON.parse(rawResponse) as FactusBillResponse;
    } catch {
      throw new Error(`Factus devolvio una respuesta no-JSON (status ${res.status}): ${rawResponse.slice(0, 500)}`);
    }

    if (res.status === 201 && parsed.data?.is_validated && parsed.data.cufe && parsed.data.number) {
      // Si devolvio otro documento (mismo reference_code de antes), su CUFE no es el de esta venta.
      const returnedTotal = Number(parsed.data.totals?.total);
      if (parsed.data.totals?.total !== undefined && Math.abs(returnedTotal - input.total) > 1) {
        throw new Error(
          `Factus devolvio otro documento (${parsed.data.number}, total ${returnedTotal}) en vez de crear esta factura (total ${input.total})`
        );
      }
      return { status: "ACCEPTED", cufe: parsed.data.cufe, signedXmlContent: "", rawResponse };
    }

    // El detalle por campo viene en data.errors o errors; "Error de validacion" solo no dice que corregir.
    const fieldErrors = parsed.data?.errors ?? parsed.errors;
    const details = fieldErrors ? Object.values(fieldErrors).flat().join(" ") : "";
    const rejectionReason =
      [parsed.message, details].filter(Boolean).join(": ") || `Respuesta inesperada de Factus (status ${res.status})`;

    return { status: "REJECTED", cufe: parsed.data?.cufe ?? "", signedXmlContent: "", rejectionReason, rawResponse };
  }

  private async downloadSignedXml(accessToken: string, rawBillResponse: string): Promise<string> {
    // El numero de documento (no el CUFE) es lo que identifica la factura para descargar el XML.
    let documentNumber: string | undefined;
    try {
      documentNumber = (JSON.parse(rawBillResponse) as FactusBillResponse).data?.number;
    } catch {
      // rawResponse ya se valido como JSON en createBill, esto no deberia pasar.
    }
    if (!documentNumber) return "";

    const res = await fetch(`${env.FACTUS_BASE_URL}/v2/bills/${documentNumber}/download-xml`, {
      headers: { Authorization: `Bearer ${accessToken}`, Accept: "application/json" },
    });
    if (!res.ok) return "";

    const raw = await res.text();
    try {
      const parsed = JSON.parse(raw) as FactusXmlResponse;
      const base64 = parsed.data?.xml_base_64_encoded;
      return base64 ? Buffer.from(base64, "base64").toString("utf-8") : "";
    } catch {
      return "";
    }
  }
}
