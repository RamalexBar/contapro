import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { formatCOP } from "@erp/shared-utils";
import { Card } from "../../../components/ui/Card";
import { Input } from "../../../components/ui/Input";
import { Alert } from "../../../components/ui/Alert";
import { Button } from "../../../components/ui/Button";
import { Spinner } from "../../../components/ui/Spinner";
import { getNiifStatements, type NiifLine } from "../api/accounting.api";

const today = () => new Date().toISOString().slice(0, 10);
const startOfYear = () => `${new Date().getFullYear()}-01-01`;

/** Un renglon NIIF; al abrirlo muestra las cuentas PUC que lo forman. */
function Line({ line, bold }: { line: NiifLine; bold?: boolean }) {
  if (!line.accounts.length) {
    return (
      <div className={`flex justify-between py-1 text-sm ${bold ? "font-semibold" : ""}`}>
        <span>{line.line}</span>
        <span>{formatCOP(line.amount)}</span>
      </div>
    );
  }
  return (
    <details className="group py-1 text-sm">
      <summary className="flex cursor-pointer list-none justify-between hover:text-brand-700">
        <span>
          <span className="no-print mr-1 inline-block text-slate-400 transition-transform group-open:rotate-90">›</span>
          {line.line}
        </span>
        <span>{formatCOP(line.amount)}</span>
      </summary>
      <div className="ml-5 mt-1 space-y-0.5 border-l border-slate-200 pl-3 text-xs text-slate-500">
        {line.accounts.map((a) => (
          <div key={`${a.code}-${a.name}`} className="flex justify-between">
            <span>
              {a.code && <span className="mr-1 font-mono">{a.code}</span>}
              {a.name}
            </span>
            <span>{formatCOP(a.amount)}</span>
          </div>
        ))}
      </div>
    </details>
  );
}

const Total = ({ label, amount, strong }: { label: string; amount: number; strong?: boolean }) => (
  <div className={`mt-1 flex justify-between border-t border-slate-200 pt-1 text-sm ${strong ? "font-bold text-slate-900" : "font-semibold"}`}>
    <span>{label}</span>
    <span>{formatCOP(amount)}</span>
  </div>
);

/**
 * Estados financieros con la presentacion de NIIF para PYMES, armados con los mismos saldos de la contabilidad (que se
 * sigue llevando con el PUC). La clasificacion es una propuesta: el contador la revisa antes de presentarlos.
 */
export function NiifStatementsReport({ branchId }: { branchId?: string }) {
  const [from, setFrom] = useState(startOfYear());
  const [asOf, setAsOf] = useState(today());
  const { data, isLoading, error } = useQuery({
    queryKey: ["accounting", "niif", from, asOf, branchId ?? ""],
    queryFn: () => getNiifStatements(asOf, from, branchId),
  });

  return (
    <div className="space-y-4">
      <Card>
        <div className="no-print flex flex-wrap items-end gap-3">
          <Input label="Resultados desde" type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
          <Input label="Corte" type="date" value={asOf} onChange={(e) => setAsOf(e.target.value)} />
          <Button variant="secondary" onClick={() => window.print()}>
            Imprimir
          </Button>
        </div>
        <p className="mt-3 text-xs text-slate-500">
          Presentación de NIIF para PYMES (Grupo 2) con los mismos saldos del Balance General y del Estado de Resultados. Cada cuenta del PUC va al
          renglón NIIF de su código; abra un renglón para ver sus cuentas. Es una clasificación propuesta: su contador debe revisarla antes de
          presentar los estados (por ejemplo, una deuda a más de un año es no corriente).
        </p>
      </Card>

      {isLoading && <Spinner />}
      {error && <Alert tone="danger">{(error as Error).message}</Alert>}

      {data && (
        <>
          {!data.financialPosition.balanced && (
            <Alert tone="warning">El activo no es igual al pasivo más el patrimonio: revise los comprobantes del periodo.</Alert>
          )}
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <Card title={`Estado de Situación Financiera al ${asOf}`}>
              {data.financialPosition.sections.map((s) => (
                <div key={s.key} className="mb-4">
                  <h3 className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-500">{s.title}</h3>
                  {s.lines.length === 0 ? <p className="text-sm text-slate-400">—</p> : s.lines.map((l) => <Line key={l.line} line={l} />)}
                  <Total label={`Total ${s.title.toLowerCase()}`} amount={s.total} />
                  {s.key === "nonCurrentAssets" && <Total label="TOTAL ACTIVO" amount={data.financialPosition.totalAssets} strong />}
                  {s.key === "nonCurrentLiabilities" && <Total label="TOTAL PASIVO" amount={data.financialPosition.totalLiabilities} strong />}
                </div>
              ))}
              <Total label="TOTAL PASIVO Y PATRIMONIO" amount={data.financialPosition.totalLiabilities + data.financialPosition.totalEquity} strong />
            </Card>

            <Card title={`Estado de Resultados del ${from} al ${asOf}`}>
              <Line line={data.profitOrLoss.lines.revenue} />
              <Line line={data.profitOrLoss.lines.costOfSales} />
              <Total label="Ganancia bruta" amount={data.profitOrLoss.grossProfit} />
              <div className="mt-3">
                <Line line={data.profitOrLoss.lines.otherIncome} />
                <Line line={data.profitOrLoss.lines.adminExpenses} />
                <Line line={data.profitOrLoss.lines.sellingExpenses} />
                <Line line={data.profitOrLoss.lines.otherExpenses} />
              </div>
              <Total label="Ganancia (pérdida) por actividades de operación" amount={data.profitOrLoss.operatingProfit} />
              <div className="mt-3">
                <Line line={data.profitOrLoss.lines.financeIncome} />
                <Line line={data.profitOrLoss.lines.financeCosts} />
              </div>
              <Total label="Ganancia (pérdida) antes de impuestos" amount={data.profitOrLoss.profitBeforeTax} />
              <div className="mt-3">
                <Line line={data.profitOrLoss.lines.incomeTax} />
              </div>
              <Total label="GANANCIA (PÉRDIDA) DEL PERIODO" amount={data.profitOrLoss.profitForPeriod} strong />
              <p className="mt-3 text-xs text-slate-500">Los costos y gastos se muestran en positivo y se restan en cada subtotal.</p>
            </Card>
          </div>
        </>
      )}
    </div>
  );
}
