import { round2 } from "@erp/shared-utils";
import type { AccountType } from "../domain/chart-of-accounts.repository";
import type { ThirdPartyRef } from "../domain/third-party-resolver";

export interface TrialBalanceLine {
  accountId: string;
  date: Date;
  debit: number;
  credit: number;
  sourceType: string | null;
  sourceId: string | null;
}

export interface TrialBalanceAmounts {
  opening: number;
  debit: number;
  credit: number;
  closing: number;
}

export interface TrialBalanceThirdPartyRow extends TrialBalanceAmounts {
  /** null = "Sin tercero identificado" (consumidor final, cierres de caja, nomina global, ajustes...). */
  thirdPartyId: string | null;
  name: string;
  document: string | null;
}

export interface TrialBalanceAccountRow extends TrialBalanceAmounts {
  accountId: string;
  code: string;
  name: string;
  type: AccountType;
  /** DEBIT: activos y gastos/costos (saldo = debitos - creditos). CREDIT: pasivos, patrimonio e ingresos. */
  nature: "DEBIT" | "CREDIT";
  thirdParties: TrialBalanceThirdPartyRow[];
}

export interface TrialBalanceByThirdParty {
  from: string;
  to: string;
  accounts: TrialBalanceAccountRow[];
  /** Movimiento del periodo: en una contabilidad cuadrada totalDebit === totalCredit. */
  totalDebit: number;
  totalCredit: number;
}

const UNIDENTIFIED = "Sin tercero identificado";
const NOMINAL_TYPES = new Set<AccountType>(["INCOME", "EXPENSE"]);

function natureOf(type: AccountType): "DEBIT" | "CREDIT" {
  return type === "ASSET" || type === "EXPENSE" ? "DEBIT" : "CREDIT";
}

function signed(nature: "DEBIT" | "CREDIT", debit: number, credit: number): number {
  return nature === "DEBIT" ? debit - credit : credit - debit;
}

/**
 * Balance de prueba por tercero: por cada cuenta con saldo o movimiento, saldo inicial, debitos, creditos y saldo
 * final del periodo, abiertos por tercero (cliente/proveedor/empleado/beneficiario del documento que origino cada
 * comprobante).
 *
 * El saldo inicial de las cuentas de balance (activo, pasivo, patrimonio) es todo lo anterior a `from`. El de las de
 * resultado (ingresos, gastos y costos) arranca el 1 de enero del ano de `from`: se cierran cada ano, y el modulo no
 * genera asiento de cierre formal (ver README de contabilidad).
 *
 * @param lines lineas POSTED hasta `to` inclusive (todo el historico; esta funcion separa saldo inicial y periodo)
 * @param thirdPartyByKey tercero de cada documento origen, clave `${sourceType}:${sourceId}`
 */
export function buildTrialBalanceByThirdParty(params: {
  from: Date;
  to: Date;
  accounts: Array<{ id: string; code: string; name: string; type: AccountType }>;
  lines: TrialBalanceLine[];
  thirdPartyByKey: Map<string, ThirdPartyRef>;
}): TrialBalanceByThirdParty {
  const { from, to, accounts, lines, thirdPartyByKey } = params;
  const accountById = new Map(accounts.map((a) => [a.id, a]));
  // 1 de enero en Colombia (UTC-5 fijo) del ano en que cae `from` en Colombia.
  const fromYearInBogota = new Date(from.getTime() - 5 * 3600 * 1000).getUTCFullYear();
  const fiscalYearStart = new Date(`${fromYearInBogota}-01-01T00:00:00.000-05:00`);

  type Acc = { openDebit: number; openCredit: number; debit: number; credit: number; name: string; document: string | null };
  const byAccount = new Map<string, Map<string, Acc>>();

  for (const line of lines) {
    const account = accountById.get(line.accountId);
    if (!account || line.date > to) continue;
    const inPeriod = line.date >= from;
    if (!inPeriod && NOMINAL_TYPES.has(account.type) && line.date < fiscalYearStart) continue;

    const ref = line.sourceType && line.sourceId ? thirdPartyByKey.get(`${line.sourceType}:${line.sourceId}`) : undefined;
    const key = ref ? ref.id : "";
    const parties = byAccount.get(account.id) ?? new Map<string, Acc>();
    const acc = parties.get(key) ?? { openDebit: 0, openCredit: 0, debit: 0, credit: 0, name: ref?.name ?? UNIDENTIFIED, document: ref?.document ?? null };
    if (inPeriod) {
      acc.debit += line.debit;
      acc.credit += line.credit;
    } else {
      acc.openDebit += line.debit;
      acc.openCredit += line.credit;
    }
    parties.set(key, acc);
    byAccount.set(account.id, parties);
  }

  const rows: TrialBalanceAccountRow[] = [];
  let totalDebit = 0;
  let totalCredit = 0;
  for (const account of [...accounts].sort((a, b) => a.code.localeCompare(b.code))) {
    const parties = byAccount.get(account.id);
    if (!parties) continue;
    const nature = natureOf(account.type);

    const thirdParties: TrialBalanceThirdPartyRow[] = [];
    for (const [key, acc] of parties) {
      const opening = round2(signed(nature, acc.openDebit, acc.openCredit));
      const debit = round2(acc.debit);
      const credit = round2(acc.credit);
      const closing = round2(opening + signed(nature, debit, credit));
      if (opening === 0 && debit === 0 && credit === 0 && closing === 0) continue;
      thirdParties.push({ thirdPartyId: key || null, name: acc.name, document: acc.document, opening, debit, credit, closing });
    }
    if (thirdParties.length === 0) continue;
    // Terceros identificados en orden alfabetico, "Sin tercero identificado" al final.
    thirdParties.sort((a, b) => (a.thirdPartyId === null ? 1 : b.thirdPartyId === null ? -1 : a.name.localeCompare(b.name)));

    const sum = (field: keyof TrialBalanceAmounts) => round2(thirdParties.reduce((s, p) => s + p[field], 0));
    const row: TrialBalanceAccountRow = {
      accountId: account.id,
      code: account.code,
      name: account.name,
      type: account.type,
      nature,
      opening: sum("opening"),
      debit: sum("debit"),
      credit: sum("credit"),
      closing: sum("closing"),
      thirdParties,
    };
    totalDebit += row.debit;
    totalCredit += row.credit;
    rows.push(row);
  }

  return { from: from.toISOString(), to: to.toISOString(), accounts: rows, totalDebit: round2(totalDebit), totalCredit: round2(totalCredit) };
}
