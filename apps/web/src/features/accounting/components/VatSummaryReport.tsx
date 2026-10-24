import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { formatCOP } from "@erp/shared-utils";
import { Card } from "../../../components/ui/Card";
import { Select } from "../../../components/ui/Select";
import { Alert } from "../../../components/ui/Alert";
import { Spinner } from "../../../components/ui/Spinner";
import { Table, TableHead, TableBody, TableRow, Th, Td } from "../../../components/ui/Table";
import { getVatSummary } from "../api/accounting.api";

type Frequency = "bimonthly" | "fourmonthly";

const MONTHS = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];

/** Periodos de la declaracion de IVA: bimestral (6 al año) o cuatrimestral (3 al año). */
function periodsOf(frequency: Frequency, year: number) {
  const size = frequency === "bimonthly" ? 2 : 4;
  const pad = (n: number) => String(n).padStart(2, "0");
  return Array.from({ length: 12 / size }, (_, i) => {
    const first = i * size;
    const last = first + size - 1;
    const lastDay = new Date(year, last + 1, 0).getDate();
    return {
      label: `${i + 1} · ${MONTHS[first]}–${MONTHS[last]}`,
      from: `${year}-${pad(first + 1)}-01`,
      to: `${year}-${pad(last + 1)}-${pad(lastDay)}`,
    };
  });
}

const currentPeriodIndex = (frequency: Frequency) => Math.floor(new Date().getMonth() / (frequency === "bimonthly" ? 2 : 4));

function rateLabel(taxType: string, taxRate: number) {
  if (taxType === "EXEMPT") return "Exento";
  if (taxType === "EXCLUDED") return "Excluido";
  if (taxType === "INC") return `Impuesto al consumo ${taxRate} %`;
  return taxRate === 0 ? "0 % (exento o excluido)" : `IVA ${taxRate} %`;
}

/** Resumen de IVA para pasarle al formulario 300: lo que se cobro, lo que se pago y lo que queda. */
export function VatSummaryReport({ branchId }: { branchId?: string }) {
  const thisYear = new Date().getFullYear();
  const [frequency, setFrequency] = useState<Frequency>("bimonthly");
  const [year, setYear] = useState(thisYear);
  const [index, setIndex] = useState(currentPeriodIndex("bimonthly"));
  const periods = periodsOf(frequency, year);
  const period = periods[Math.min(index, periods.length - 1)] ?? periods[0]!;

  const { data, isLoading, error } = useQuery({
    queryKey: ["accounting", "vat-summary", period.from, period.to, branchId ?? ""],
    queryFn: () => getVatSummary(period.from, period.to, branchId),
  });

  return (
    <Card>
      <div className="no-print mb-4 flex flex-wrap items-end gap-3">
        <Select
          label="Declara IVA"
          value={frequency}
          onChange={(e) => {
            const f = e.target.value as Frequency;
            setFrequency(f);
            setIndex(currentPeriodIndex(f));
          }}
        >
          <option value="bimonthly">Bimestral</option>
          <option value="fourmonthly">Cuatrimestral</option>
        </Select>
        <Select label="Año" value={String(year)} onChange={(e) => setYear(Number(e.target.value))}>
          {[thisYear, thisYear - 1, thisYear - 2].map((y) => (
            <option key={y} value={y}>
              {y}
            </option>
          ))}
        </Select>
        <Select label="Periodo" value={String(index)} onChange={(e) => setIndex(Number(e.target.value))}>
          {periods.map((p, i) => (
            <option key={p.from} value={i}>
              {p.label}
            </option>
          ))}
        </Select>
      </div>
      <p className="mb-3 text-sm text-slate-500">
        Del {period.from} al {period.to}. Se declara bimestral si los ingresos del año anterior pasaron de 92.000 UVT; si no, cuatrimestral.
      </p>

      {isLoading && <Spinner />}
      {error && <Alert tone="danger">{(error as Error).message}</Alert>}

      {data && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <div className="rounded-lg bg-slate-50 p-3">
              <p className="text-sm text-slate-500">IVA cobrado en ventas</p>
              <p className="text-lg font-semibold text-slate-900">{formatCOP(data.generated)}</p>
            </div>
            <div className="rounded-lg bg-slate-50 p-3">
              <p className="text-sm text-slate-500">IVA descontable y devoluciones</p>
              <p className="text-lg font-semibold text-slate-900">{formatCOP(data.deductible)}</p>
            </div>
            <div className={`rounded-lg p-3 ${data.balance > 0 ? "bg-amber-50" : "bg-emerald-50"}`}>
              <p className="text-sm text-slate-600">{data.balance >= 0 ? "IVA a pagar a la DIAN" : "Saldo a favor"}</p>
              <p className="text-lg font-semibold text-slate-900">{formatCOP(Math.abs(data.balance))}</p>
            </div>
          </div>

          <div>
            <h3 className="mb-2 text-sm font-semibold text-slate-900">De dónde sale</h3>
            {data.byOrigin.length === 0 ? (
              <p className="text-sm text-slate-500">No hay movimientos de IVA en este periodo.</p>
            ) : (
              <Table>
                <TableHead>
                  <tr>
                    <Th>Origen</Th>
                    <Th>IVA cobrado</Th>
                    <Th>IVA descontable / devuelto</Th>
                  </tr>
                </TableHead>
                <TableBody>
                  {data.byOrigin.map((o) => (
                    <TableRow key={o.origin}>
                      <Td>{o.label}</Td>
                      <Td>{formatCOP(o.generated)}</Td>
                      <Td>{formatCOP(o.deductible)}</Td>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </div>

          {data.byRate.length > 0 && (
            <div>
              <h3 className="mb-2 text-sm font-semibold text-slate-900">Ventas por tarifa (renglones de ingresos del formulario 300)</h3>
              <Table>
                <TableHead>
                  <tr>
                    <Th>Tarifa</Th>
                    <Th>Base ventas</Th>
                    <Th>Impuesto ventas</Th>
                    <Th>Base devoluciones</Th>
                    <Th>Impuesto devoluciones</Th>
                  </tr>
                </TableHead>
                <TableBody>
                  {data.byRate.map((r) => (
                    <TableRow key={`${r.taxType}-${r.taxRate}`}>
                      <Td>{rateLabel(r.taxType, r.taxRate)}</Td>
                      <Td>{formatCOP(r.salesBase)}</Td>
                      <Td>{formatCOP(r.salesTax)}</Td>
                      <Td>{formatCOP(r.returnsBase)}</Td>
                      <Td>{formatCOP(r.returnsTax)}</Td>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              {data.shiftClosesWithoutDetail > 0 && (
                <p className="mt-2 text-xs text-slate-500">
                  {data.shiftClosesWithoutDetail} cierre(s) de caja anteriores al 24 de octubre de 2026 no traen el detalle por tarifa: su IVA sí está en
                  los totales de arriba.
                </p>
              )}
            </div>
          )}

          {data.consumptionTax !== 0 && (
            <Alert tone="info">
              Impuesto al consumo del periodo: <b>{formatCOP(data.consumptionTax)}</b>. No es IVA: se declara aparte, en el formulario 310.
            </Alert>
          )}

          <p className="text-xs text-slate-500">
            Los totales salen de la cuenta 2408 de la contabilidad (lo mismo que muestra el Balance). Es una guía para llenar el formulario 300:
            su contador debe revisarla, sobre todo las retenciones de IVA que le hayan practicado, que no aparecen aquí.
          </p>
        </div>
      )}
    </Card>
  );
}
