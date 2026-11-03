import { round2 } from "@erp/shared-utils";
import type { AccountBalance, BalanceSheet, IncomeStatement } from "./accounting-reports.service";

/**
 * Estados financieros con la presentacion de NIIF para PYMES (Seccion 4: Estado de Situacion Financiera, corriente /
 * no corriente; Seccion 5: Estado de Resultados por funcion), armados con los MISMOS saldos del Balance General y del
 * Estado de Resultados (el registro sigue siendo con el PUC). Cada cuenta va al renglon NIIF de su codigo PUC
 * (gana el prefijo mas largo). Es una clasificacion PROPUESTA: el contador debe revisarla (ej. una obligacion
 * financiera a mas de un año es no corriente, una inversion permanente tambien). Nada se pierde: lo que no
 * encaja sale como «sin clasificar» y los totales cuadran con el Balance General.
 */

type Section = "currentAssets" | "nonCurrentAssets" | "currentLiabilities" | "nonCurrentLiabilities" | "equity";
type PlLine =
  | "revenue"
  | "costOfSales"
  | "otherIncome"
  | "adminExpenses"
  | "sellingExpenses"
  | "otherExpenses"
  | "financeIncome"
  | "financeCosts"
  | "incomeTax";

interface Rule<K> {
  prefix: string;
  key: K;
  line: string;
}

const POSITION_RULES: Rule<Section>[] = [
  { prefix: "11", key: "currentAssets", line: "Efectivo y equivalentes al efectivo" },
  { prefix: "12", key: "currentAssets", line: "Inversiones" },
  { prefix: "13", key: "currentAssets", line: "Deudores comerciales y otras cuentas por cobrar" },
  { prefix: "1355", key: "currentAssets", line: "Activos por impuestos corrientes" },
  { prefix: "14", key: "currentAssets", line: "Inventarios" },
  { prefix: "17", key: "currentAssets", line: "Gastos pagados por anticipado y otros activos" },
  { prefix: "15", key: "nonCurrentAssets", line: "Propiedades, planta y equipo" },
  { prefix: "16", key: "nonCurrentAssets", line: "Activos intangibles" },
  { prefix: "18", key: "nonCurrentAssets", line: "Otros activos no corrientes" },
  { prefix: "19", key: "nonCurrentAssets", line: "Valorizaciones (NIIF no las reconoce: revisar)" },
  { prefix: "21", key: "currentLiabilities", line: "Obligaciones financieras" },
  { prefix: "22", key: "currentLiabilities", line: "Cuentas comerciales por pagar" },
  { prefix: "23", key: "currentLiabilities", line: "Otras cuentas por pagar" },
  { prefix: "2365", key: "currentLiabilities", line: "Pasivos por impuestos corrientes" },
  { prefix: "2367", key: "currentLiabilities", line: "Pasivos por impuestos corrientes" },
  { prefix: "2368", key: "currentLiabilities", line: "Pasivos por impuestos corrientes" },
  { prefix: "24", key: "currentLiabilities", line: "Pasivos por impuestos corrientes" },
  { prefix: "25", key: "currentLiabilities", line: "Beneficios a los empleados" },
  { prefix: "26", key: "currentLiabilities", line: "Provisiones" },
  { prefix: "28", key: "currentLiabilities", line: "Otros pasivos" },
  { prefix: "27", key: "nonCurrentLiabilities", line: "Pasivos diferidos" },
  { prefix: "29", key: "nonCurrentLiabilities", line: "Bonos y papeles comerciales" },
  { prefix: "31", key: "equity", line: "Capital social" },
  { prefix: "32", key: "equity", line: "Superavit de capital" },
  { prefix: "33", key: "equity", line: "Reservas" },
  { prefix: "34", key: "equity", line: "Revalorizacion del patrimonio" },
  { prefix: "35", key: "equity", line: "Dividendos o participaciones decretados" },
  { prefix: "36", key: "equity", line: "Resultados del ejercicio (cerrados)" },
  { prefix: "37", key: "equity", line: "Resultados de ejercicios anteriores" },
  { prefix: "38", key: "equity", line: "Superavit por valorizaciones (NIIF no lo reconoce: revisar)" },
];

const PL_RULES: Rule<PlLine>[] = [
  { prefix: "41", key: "revenue", line: "Ingresos de actividades ordinarias" },
  { prefix: "42", key: "otherIncome", line: "Otros ingresos" },
  { prefix: "4210", key: "financeIncome", line: "Ingresos financieros" },
  { prefix: "6", key: "costOfSales", line: "Costo de ventas" },
  { prefix: "7", key: "costOfSales", line: "Costo de ventas" },
  { prefix: "51", key: "adminExpenses", line: "Gastos de administracion" },
  { prefix: "52", key: "sellingExpenses", line: "Gastos de ventas" },
  { prefix: "53", key: "otherExpenses", line: "Otros gastos" },
  { prefix: "5305", key: "financeCosts", line: "Costos financieros" },
  { prefix: "54", key: "incomeTax", line: "Gasto por impuesto de renta" },
];

const ruleFor = <K>(rules: Rule<K>[], code: string) =>
  rules.filter((r) => code.startsWith(r.prefix)).sort((a, b) => b.prefix.length - a.prefix.length)[0];

export interface NiifAccount {
  code: string;
  name: string;
  amount: number;
}
export interface NiifLine {
  line: string;
  amount: number;
  accounts: NiifAccount[];
}
export interface NiifSection {
  key: Section;
  title: string;
  lines: NiifLine[];
  total: number;
}

export interface NiifFinancialPosition {
  asOf: string;
  sections: NiifSection[];
  totalAssets: number;
  totalLiabilities: number;
  totalEquity: number;
  /** Activo = pasivo + patrimonio (debe cuadrar como el Balance General). */
  balanced: boolean;
}

export interface NiifProfitOrLoss {
  from: string;
  to: string;
  lines: Record<PlLine, NiifLine>;
  grossProfit: number;
  operatingProfit: number;
  profitBeforeTax: number;
  profitForPeriod: number;
}

const SECTION_TITLES: Record<Section, string> = {
  currentAssets: "Activo corriente",
  nonCurrentAssets: "Activo no corriente",
  currentLiabilities: "Pasivo corriente",
  nonCurrentLiabilities: "Pasivo no corriente",
  equity: "Patrimonio",
};

/** Agrupa cuentas en renglones (en el orden de las reglas), sumando sus saldos. */
function group<K extends string>(
  items: { key: K; line: string; account: NiifAccount }[],
  order: Rule<K>[]
): Map<K, NiifLine[]> {
  const byKey = new Map<K, Map<string, NiifLine>>();
  for (const it of items) {
    const lines = byKey.get(it.key) ?? new Map<string, NiifLine>();
    const line = lines.get(it.line) ?? { line: it.line, amount: 0, accounts: [] };
    line.amount = round2(line.amount + it.account.amount);
    line.accounts.push(it.account);
    lines.set(it.line, line);
    byKey.set(it.key, lines);
  }
  const lineOrder = order.map((r) => r.line);
  const out = new Map<K, NiifLine[]>();
  for (const [key, lines] of byKey) {
    out.set(
      key,
      [...lines.values()].sort((a, b) => {
        const ia = lineOrder.indexOf(a.line);
        const ib = lineOrder.indexOf(b.line);
        return (ia < 0 ? 999 : ia) - (ib < 0 ? 999 : ib);
      })
    );
  }
  return out;
}

const toAccount = (a: AccountBalance): NiifAccount => ({ code: a.code, name: a.name, amount: a.balance });

export function buildNiifFinancialPosition(bs: BalanceSheet): NiifFinancialPosition {
  const items: { key: Section; line: string; account: NiifAccount }[] = [];
  const place = (a: AccountBalance, fallback: Section, fallbackLine: string) => {
    const rule = ruleFor(POSITION_RULES, a.code);
    // La regla manda solo si coincide con el tipo de la cuenta (un activo nunca termina como pasivo)
    const kind = (k: Section) => (k.endsWith("Assets") ? "asset" : k.endsWith("Liabilities") ? "liability" : "equity");
    const ok = rule && kind(rule.key) === kind(fallback);
    items.push({ key: ok ? rule.key : fallback, line: ok ? rule.line : fallbackLine, account: toAccount(a) });
  };
  bs.assets.forEach((a) => place(a, "currentAssets", "Otros activos (sin clasificar)"));
  bs.liabilities.forEach((a) => place(a, "currentLiabilities", "Otros pasivos (sin clasificar)"));
  bs.equity.forEach((a) => place(a, "equity", "Otras partidas de patrimonio (sin clasificar)"));
  if (bs.netIncome !== 0) {
    items.push({ key: "equity", line: "Resultados acumulados sin cerrar", account: { code: "", name: "Ingresos menos costos y gastos aun no cerrados", amount: bs.netIncome } });
  }

  const grouped = group(items, [...POSITION_RULES, { prefix: "", key: "equity", line: "Resultados acumulados sin cerrar" }]);
  const sections = (Object.keys(SECTION_TITLES) as Section[]).map((key) => {
    const lines = grouped.get(key) ?? [];
    return { key, title: SECTION_TITLES[key], lines, total: round2(lines.reduce((s, l) => s + l.amount, 0)) };
  });
  const total = (...keys: Section[]) => round2(sections.filter((s) => keys.includes(s.key)).reduce((sum, s) => sum + s.total, 0));
  const totalAssets = total("currentAssets", "nonCurrentAssets");
  const totalLiabilities = total("currentLiabilities", "nonCurrentLiabilities");
  const totalEquity = total("equity");
  return {
    asOf: bs.asOf,
    sections,
    totalAssets,
    totalLiabilities,
    totalEquity,
    balanced: Math.abs(totalAssets - (totalLiabilities + totalEquity)) < 0.01,
  };
}

export function buildNiifProfitOrLoss(is: IncomeStatement): NiifProfitOrLoss {
  const items: { key: PlLine; line: string; account: NiifAccount }[] = [];
  for (const a of is.income) {
    const rule = ruleFor(PL_RULES, a.code);
    const ok = rule && ["revenue", "otherIncome", "financeIncome"].includes(rule.key);
    items.push({ key: ok ? rule.key : "otherIncome", line: ok ? rule.line : "Otros ingresos", account: toAccount(a) });
  }
  for (const a of is.expenses) {
    const rule = ruleFor(PL_RULES, a.code);
    const ok = rule && !["revenue", "otherIncome", "financeIncome"].includes(rule.key);
    items.push({ key: ok ? rule.key : "otherExpenses", line: ok ? rule.line : "Otros gastos", account: toAccount(a) });
  }
  const grouped = group(items, PL_RULES);
  const titles: Record<PlLine, string> = {
    revenue: "Ingresos de actividades ordinarias",
    costOfSales: "Costo de ventas",
    otherIncome: "Otros ingresos",
    adminExpenses: "Gastos de administracion",
    sellingExpenses: "Gastos de ventas",
    otherExpenses: "Otros gastos",
    financeIncome: "Ingresos financieros",
    financeCosts: "Costos financieros",
    incomeTax: "Gasto por impuesto de renta",
  };
  const lines = Object.fromEntries(
    (Object.keys(titles) as PlLine[]).map((k) => {
      const ls = grouped.get(k) ?? [];
      return [k, { line: titles[k], amount: round2(ls.reduce((s, l) => s + l.amount, 0)), accounts: ls.flatMap((l) => l.accounts) }];
    })
  ) as Record<PlLine, NiifLine>;
  const v = (k: PlLine) => lines[k].amount;
  const grossProfit = round2(v("revenue") - v("costOfSales"));
  const operatingProfit = round2(grossProfit + v("otherIncome") - v("adminExpenses") - v("sellingExpenses") - v("otherExpenses"));
  const profitBeforeTax = round2(operatingProfit + v("financeIncome") - v("financeCosts"));
  return { from: is.from, to: is.to, lines, grossProfit, operatingProfit, profitBeforeTax, profitForPeriod: round2(profitBeforeTax - v("incomeTax")) };
}
