import { Fragment, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { formatCOP } from "@erp/shared-utils";
import { Card } from "../../../components/ui/Card";
import { Input } from "../../../components/ui/Input";
import { Button } from "../../../components/ui/Button";
import { Alert } from "../../../components/ui/Alert";
import { Spinner } from "../../../components/ui/Spinner";
import { Table, TableHead, TableBody, TableRow, Th, Td } from "../../../components/ui/Table";
import { downloadWorkbook } from "../../../lib/spreadsheet";
import { getTrialBalanceByThirdParty, type TrialBalanceByThirdParty } from "../api/accounting.api";

function localDate(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function exportToExcel(data: TrialBalanceByThirdParty, from: string, to: string) {
  const rows: unknown[][] = [
    [`Balance de prueba por tercero del ${from} al ${to}`],
    [],
    ["Cuenta", "Nombre de la cuenta", "NIT / documento", "Tercero", "Saldo inicial", "Débitos", "Créditos", "Saldo final"],
  ];
  for (const account of data.accounts) {
    rows.push([account.code, account.name, "", "TOTAL CUENTA", account.opening, account.debit, account.credit, account.closing]);
    for (const p of account.thirdParties) {
      rows.push([account.code, account.name, p.document ?? "", p.name, p.opening, p.debit, p.credit, p.closing]);
    }
  }
  rows.push([], ["", "", "", "TOTALES DEL PERIODO", "", data.totalDebit, data.totalCredit, ""]);
  return downloadWorkbook(`balance-prueba-terceros_${from}_${to}.xlsx`, "Balance x tercero", rows, [12, 34, 16, 34, 16, 16, 16, 16]);
}

/** Balance de prueba por tercero: todas las cuentas con saldo o movimiento, abiertas por NIT. */
export function TrialBalanceByThirdPartyReport({ branchId }: { branchId?: string }) {
  const now = new Date();
  const [from, setFrom] = useState(localDate(new Date(now.getFullYear(), now.getMonth(), 1)));
  const [to, setTo] = useState(localDate(now));
  const [showThirdParties, setShowThirdParties] = useState(true);
  const [search, setSearch] = useState("");

  const { data, isLoading, error } = useQuery({
    queryKey: ["accounting", "trial-balance-third-party", from, to, branchId ?? ""],
    queryFn: () => getTrialBalanceByThirdParty(from, to, branchId),
    enabled: !!from && !!to && from <= to,
  });

  const term = search.trim().toLowerCase();
  const accounts = (data?.accounts ?? [])
    .map((a) => {
      if (!term) return a;
      const accountMatch = a.code.startsWith(term) || a.name.toLowerCase().includes(term);
      const parties = a.thirdParties.filter((p) => p.name.toLowerCase().includes(term) || (p.document ?? "").includes(term));
      return accountMatch ? a : parties.length ? { ...a, thirdParties: parties } : null;
    })
    .filter((a): a is NonNullable<typeof a> => a !== null);
  const balanced = data ? Math.abs(data.totalDebit - data.totalCredit) < 0.01 : true;

  return (
    <Card>
      <div className="no-print mb-4 flex flex-wrap items-end gap-3">
        <Input type="date" label="Desde" value={from} onChange={(e) => setFrom(e.target.value)} />
        <Input type="date" label="Hasta" value={to} onChange={(e) => setTo(e.target.value)} />
        <Input label="Buscar cuenta, tercero o NIT" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Ej. 1305 o 900123456" />
        <label className="flex items-center gap-2 pb-2 text-sm text-slate-700">
          <input type="checkbox" checked={showThirdParties} onChange={(e) => setShowThirdParties(e.target.checked)} />
          Mostrar terceros
        </label>
        <Button size="sm" variant="secondary" disabled={!data} onClick={() => data && void exportToExcel(data, from, to)}>
          Exportar a Excel
        </Button>
      </div>
      <p className="mb-3 text-sm text-slate-500">
        Saldo inicial, débitos, créditos y saldo final de cada cuenta, abiertos por tercero (el cliente, proveedor, vendedor o beneficiario del
        documento que originó cada comprobante). Las cuentas de ingresos, gastos y costos arrancan en cero el 1 de enero.
      </p>

      {from > to && <Alert tone="warning">La fecha inicial debe ser anterior o igual a la final.</Alert>}
      {isLoading && <Spinner />}
      {error && <Alert tone="danger">{(error as Error).message}</Alert>}
      {data && !balanced && (
        <Alert tone="warning">
          Los débitos ({formatCOP(data.totalDebit)}) no cuadran con los créditos ({formatCOP(data.totalCredit)}) en el periodo.
        </Alert>
      )}

      {data && (
        <Table>
          <TableHead>
            <tr>
              <Th>Cuenta</Th>
              <Th>Tercero</Th>
              <Th className="text-right">Saldo inicial</Th>
              <Th className="text-right">Débitos</Th>
              <Th className="text-right">Créditos</Th>
              <Th className="text-right">Saldo final</Th>
            </tr>
          </TableHead>
          <TableBody>
            {accounts.length === 0 && (
              <TableRow>
                <Td colSpan={6} className="text-center text-slate-500">
                  Sin movimientos ni saldos en el periodo.
                </Td>
              </TableRow>
            )}
            {accounts.map((a) => (
              <Fragment key={a.accountId}>
                <TableRow className="bg-slate-50 font-medium">
                  <Td className="font-semibold text-slate-900">
                    {a.code} {a.name}
                  </Td>
                  <Td className="text-slate-500">{a.thirdParties.length} tercero(s)</Td>
                  <Td className="text-right tabular-nums">{formatCOP(a.opening)}</Td>
                  <Td className="text-right tabular-nums">{formatCOP(a.debit)}</Td>
                  <Td className="text-right tabular-nums">{formatCOP(a.credit)}</Td>
                  <Td className="text-right font-semibold tabular-nums">{formatCOP(a.closing)}</Td>
                </TableRow>
                {showThirdParties &&
                  a.thirdParties.map((p) => (
                    <TableRow key={`${a.accountId}:${p.thirdPartyId ?? "none"}`}>
                      <Td />
                      <Td className="pl-6">
                        <span className={p.thirdPartyId ? "" : "italic text-slate-500"}>{p.name}</span>
                        {p.document && <span className="ml-2 text-xs text-slate-500">NIT/CC {p.document}</span>}
                      </Td>
                      <Td className="text-right tabular-nums">{formatCOP(p.opening)}</Td>
                      <Td className="text-right tabular-nums">{formatCOP(p.debit)}</Td>
                      <Td className="text-right tabular-nums">{formatCOP(p.credit)}</Td>
                      <Td className="text-right tabular-nums">{formatCOP(p.closing)}</Td>
                    </TableRow>
                  ))}
              </Fragment>
            ))}
            {accounts.length > 0 && (
              <TableRow className="border-t-2 border-slate-300 font-semibold">
                <Td colSpan={3}>Totales del periodo</Td>
                <Td className="text-right tabular-nums">{formatCOP(data.totalDebit)}</Td>
                <Td className="text-right tabular-nums">{formatCOP(data.totalCredit)}</Td>
                <Td />
              </TableRow>
            )}
          </TableBody>
        </Table>
      )}
    </Card>
  );
}
