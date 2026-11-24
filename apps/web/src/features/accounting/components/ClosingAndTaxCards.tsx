import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { formatCOP } from "@erp/shared-utils";
import { Card } from "../../../components/ui/Card";
import { Button } from "../../../components/ui/Button";
import { Input } from "../../../components/ui/Input";
import { Select } from "../../../components/ui/Select";
import { Alert } from "../../../components/ui/Alert";
import { Table, TableHead, TableBody, TableRow, Th, Td } from "../../../components/ui/Table";
import { getWithholdingReturn, payWithholdingReturn, postAnnualClosing, previewAnnualClosing } from "../api/accounting.api";

const MONTHS = ["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"];

/** Cierre contable anual: vista previa del traslado de resultados a 3605/3610 y registro. */
export function AnnualClosingCard({ canManage }: { canManage: boolean }) {
  const queryClient = useQueryClient();
  const [year, setYear] = useState(new Date().getFullYear());
  const { data, isLoading, error } = useQuery({ queryKey: ["annual-closing", year], queryFn: () => previewAnnualClosing(year) });
  const closeMutation = useMutation({
    mutationFn: () => postAnnualClosing(year),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["annual-closing", year] });
      queryClient.invalidateQueries({ queryKey: ["accounting"] });
    },
  });

  return (
    <Card title="Cierre contable anual">
      <p className="mb-3 text-sm text-slate-500">
        Deja en cero las cuentas de ingresos, gastos y costos del año y lleva el resultado a 3605 (utilidad) o 3610
        (pérdida), con un comprobante del 31 de diciembre. Hágalo después de registrar el impuesto de renta del año y antes
        de cerrar diciembre. Para rehacerlo, anule el comprobante en el Libro Diario. El Estado de Resultados del año sigue
        mostrando sus ingresos y gastos.
      </p>
      <div className="mb-3 flex items-end gap-3">
        <Input label="Año" type="number" className="w-28" value={year} onChange={(e) => setYear(Number(e.target.value))} />
        {canManage && data && !data.alreadyClosed && data.lines.length > 0 && (
          <Button loading={closeMutation.isPending} onClick={() => closeMutation.mutate()}>
            Registrar cierre de {year}
          </Button>
        )}
      </div>
      {isLoading && <p className="text-sm text-slate-500">Calculando...</p>}
      {error && <Alert tone="danger">{(error as Error).message}</Alert>}
      {closeMutation.isError && <Alert tone="danger" className="mb-3">{(closeMutation.error as Error).message}</Alert>}
      {data && (
        <>
          {data.alreadyClosed && (
            <Alert tone="success" className="mb-3">
              {year} ya está cerrado (comprobante #{data.closingEntryNumber}).
            </Alert>
          )}
          <p className="mb-2 text-sm text-slate-700">
            Ingresos {formatCOP(data.totalIncome)} · Gastos y costos {formatCOP(data.totalExpenses)} ·{" "}
            <span className={data.netIncome >= 0 ? "font-semibold text-brand-700" : "font-semibold text-danger-600"}>
              {data.netIncome >= 0 ? `Utilidad ${formatCOP(data.netIncome)}` : `Pérdida ${formatCOP(-data.netIncome)}`}
            </span>
          </p>
          {data.lines.length > 0 && !data.alreadyClosed && (
            <Table>
              <TableHead>
                <tr>
                  <Th>Cuenta</Th>
                  <Th>Débito</Th>
                  <Th>Crédito</Th>
                </tr>
              </TableHead>
              <TableBody>
                {data.lines.map((l) => (
                  <TableRow key={l.accountId}>
                    <Td>
                      {l.code} {l.name}
                    </Td>
                    <Td>{l.debit ? formatCOP(l.debit) : ""}</Td>
                    <Td>{l.credit ? formatCOP(l.credit) : ""}</Td>
                  </TableRow>
                ))}
                <TableRow>
                  <Td className="font-medium">{data.netIncome >= 0 ? "3605 Utilidad del ejercicio" : "3610 Pérdida del ejercicio"}</Td>
                  <Td>{data.netIncome < 0 ? formatCOP(-data.netIncome) : ""}</Td>
                  <Td>{data.netIncome > 0 ? formatCOP(data.netIncome) : ""}</Td>
                </TableRow>
              </TableBody>
            </Table>
          )}
        </>
      )}
    </Card>
  );
}

/** Formulario 350: retenciones practicadas del mes por renglón y registro del pago a la DIAN. */
export function WithholdingReturnReport({ canManage }: { canManage: boolean }) {
  const queryClient = useQueryClient();
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() === 0 ? 12 : now.getMonth());
  const [paidFrom, setPaidFrom] = useState<"BANK" | "CASH">("BANK");
  const [paymentDate, setPaymentDate] = useState(now.toISOString().slice(0, 10));
  const { data, isLoading, error } = useQuery({ queryKey: ["withholding-return", year, month], queryFn: () => getWithholdingReturn(year, month) });
  const payMutation = useMutation({
    mutationFn: () => payWithholdingReturn({ year, month, paidFrom, paymentDate }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["withholding-return", year, month] }),
  });

  return (
    <div className="space-y-4">
      <p className="text-sm text-slate-500">
        Guía para diligenciar el formulario 350 en el portal de la DIAN: retenciones que la empresa practicó en el mes en
        compras, nómina y prestaciones, por renglón. No incluye autorretenciones ni retenciones asumidas. La retención de ICA
        se declara al municipio y se muestra aparte.
      </p>
      <div className="flex flex-wrap items-end gap-3">
        <Input label="Año" type="number" className="w-28" value={year} onChange={(e) => setYear(Number(e.target.value))} />
        <Select label="Mes" value={month} onChange={(e) => setMonth(Number(e.target.value))}>
          {MONTHS.map((m, i) => (
            <option key={m} value={i + 1}>
              {m}
            </option>
          ))}
        </Select>
      </div>
      {isLoading && <p className="text-sm text-slate-500">Calculando...</p>}
      {error && <Alert tone="danger">{(error as Error).message}</Alert>}
      {data && (
        <>
          {data.rows.length === 0 ? (
            <p className="text-sm text-slate-500">No hay retenciones practicadas en {MONTHS[month - 1]?.toLowerCase()} de {year}.</p>
          ) : (
            <Table>
              <TableHead>
                <tr>
                  <Th>Renglón</Th>
                  <Th>Base</Th>
                  <Th>Retención</Th>
                  <Th>Documentos</Th>
                </tr>
              </TableHead>
              <TableBody>
                {data.rows.map((r) => (
                  <TableRow key={r.line}>
                    <Td>{r.label}</Td>
                    <Td>{formatCOP(r.base)}</Td>
                    <Td>{formatCOP(r.amount)}</Td>
                    <Td>{r.count}</Td>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
          <p className="text-sm text-slate-700">
            Retención en la fuente {formatCOP(data.totalRetefuente)} · Retención de IVA {formatCOP(data.totalReteiva)} ·{" "}
            <span className="font-semibold">Total a pagar (redondeado a miles) {formatCOP(data.totalToPay)}</span>
            {data.reteicaInformative > 0 && <> · ReteICA (al municipio) {formatCOP(data.reteicaInformative)}</>}
          </p>
          {data.paymentEntryNumber ? (
            <Alert tone="success">Pago registrado (comprobante #{data.paymentEntryNumber}).</Alert>
          ) : (
            canManage &&
            data.totalToPay > 0 && (
              <Card title="Registrar el pago a la DIAN">
                <p className="mb-3 text-sm text-slate-500">
                  Debita las retenciones por pagar del mes (236540, 236505 y 236705) contra bancos o caja; la diferencia del
                  redondeo va a ajuste al peso.
                </p>
                <div className="flex flex-wrap items-end gap-3">
                  <Select label="Pagado desde" value={paidFrom} onChange={(e) => setPaidFrom(e.target.value as "BANK" | "CASH")}>
                    <option value="BANK">Bancos</option>
                    <option value="CASH">Caja</option>
                  </Select>
                  <Input label="Fecha del pago" type="date" value={paymentDate} onChange={(e) => setPaymentDate(e.target.value)} />
                  <Button loading={payMutation.isPending} onClick={() => payMutation.mutate()}>
                    Registrar pago de {formatCOP(data.totalToPay)}
                  </Button>
                </div>
                {payMutation.isError && <Alert tone="danger" className="mt-3">{(payMutation.error as Error).message}</Alert>}
              </Card>
            )
          )}
        </>
      )}
    </div>
  );
}
