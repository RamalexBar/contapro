import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { formatCOP } from "@erp/shared-utils";
import { Card } from "../../../components/ui/Card";
import { Button } from "../../../components/ui/Button";
import { Input } from "../../../components/ui/Input";
import { Select } from "../../../components/ui/Select";
import { Alert } from "../../../components/ui/Alert";
import { Table, TableHead, TableBody, TableRow, Th, Td } from "../../../components/ui/Table";
import { listEmployees } from "../../employees/api/employee.api";
import {
  downloadBenefitSettlementPdf,
  listBenefitSettlements,
  previewBenefitSettlement,
  settleBenefits,
  type BenefitSettlementType,
  type SettleBenefitsInput,
  type SettleBenefitsPreview,
  type TerminationReason,
} from "../api/payroll.api";

const TYPE_LABELS: Record<BenefitSettlementType, string> = {
  SERVICE_BONUS: "Prima de servicios",
  SEVERANCE: "Cesantías e intereses (anual)",
  TERMINATION: "Liquidación de contrato",
};

const REASONS: Array<{ value: TerminationReason; label: string }> = [
  { value: "RESIGNATION", label: "Renuncia voluntaria" },
  { value: "WITHOUT_JUST_CAUSE", label: "Despido sin justa causa (con indemnización)" },
  { value: "JUST_CAUSE", label: "Despido con justa causa" },
  { value: "END_OF_TERM", label: "Terminó el plazo pactado" },
  { value: "MUTUAL_AGREEMENT", label: "Mutuo acuerdo" },
];

const day = (iso: string) => iso.slice(0, 10);

/**
 * Prestaciones sociales: la nomina mensual solo las provisiona; aqui se pagan. Siempre se ve primero
 * el calculo (vista previa) y despues se confirma, que es cuando se guarda y se contabiliza.
 */
export function BenefitSettlementsCard({ canSettle }: { canSettle: boolean }) {
  const queryClient = useQueryClient();
  const year = new Date().getFullYear();
  const [type, setType] = useState<BenefitSettlementType>("SERVICE_BONUS");
  const [form, setForm] = useState({
    year,
    semester: new Date().getMonth() < 6 ? 1 : 2,
    employeeId: "",
    reason: "RESIGNATION" as TerminationReason,
    fixedTermEndDate: "",
  });
  const [preview, setPreview] = useState<SettleBenefitsPreview | null>(null);

  const { data: employees } = useQuery({ queryKey: ["employees"], queryFn: () => listEmployees() });
  const { data: history } = useQuery({ queryKey: ["benefit-settlements"], queryFn: listBenefitSettlements });
  const retired = (employees?.data ?? []).filter((e) => e.terminationDate);
  const selected = retired.find((e) => e.id === form.employeeId);

  function input(): SettleBenefitsInput {
    if (type === "SERVICE_BONUS") return { type, year: Number(form.year), semester: form.semester as 1 | 2 };
    if (type === "SEVERANCE") return { type, year: Number(form.year) };
    return {
      type,
      employeeId: form.employeeId,
      reason: form.reason,
      fixedTermEndDate: form.fixedTermEndDate || undefined,
    };
  }

  const previewMutation = useMutation({ mutationFn: () => previewBenefitSettlement(input()), onSuccess: setPreview });
  const settleMutation = useMutation({
    mutationFn: () => settleBenefits(input()),
    onSuccess: () => {
      setPreview(null);
      queryClient.invalidateQueries({ queryKey: ["benefit-settlements"] });
    },
  });
  const error = (previewMutation.error ?? settleMutation.error) as Error | null;
  const employeeNames = new Map((employees?.data ?? []).map((e) => [e.id, `${e.firstName} ${e.lastName}`]));

  return (
    <Card className="mb-6">
      <h2 className="mb-1 text-sm font-semibold text-slate-900">Prestaciones sociales</h2>
      <p className="mb-3 text-xs text-slate-500">
        La nómina de cada mes las provisiona; aquí se pagan. Revise el cálculo y confírmelo: al confirmar queda contabilizado
        usando lo provisionado, y no se puede pagar dos veces el mismo periodo.
      </p>

      <div className="mb-3 flex flex-wrap gap-2">
        {(Object.keys(TYPE_LABELS) as BenefitSettlementType[]).map((t) => (
          <Button
            key={t}
            size="sm"
            variant={type === t ? "primary" : "secondary"}
            onClick={() => {
              setType(t);
              setPreview(null);
            }}
          >
            {TYPE_LABELS[t]}
          </Button>
        ))}
      </div>

      <form
        className="mb-3 grid grid-cols-1 gap-3 sm:grid-cols-4"
        onSubmit={(e) => {
          e.preventDefault();
          previewMutation.mutate();
        }}
      >
        {type !== "TERMINATION" && (
          <Input label="Año" type="number" value={form.year} onChange={(e) => setForm({ ...form, year: Number(e.target.value) })} required />
        )}
        {type === "SERVICE_BONUS" && (
          <Select value={form.semester} onChange={(e) => setForm({ ...form, semester: Number(e.target.value) })}>
            <option value={1}>Primer semestre (pagar antes del 30 de junio)</option>
            <option value={2}>Segundo semestre (pagar antes del 20 de diciembre)</option>
          </Select>
        )}
        {type === "TERMINATION" && (
          <>
            <Select value={form.employeeId} onChange={(e) => setForm({ ...form, employeeId: e.target.value })} required>
              <option value="">Empleado retirado…</option>
              {retired.map((e) => (
                <option key={e.id} value={e.id}>
                  {e.firstName} {e.lastName} (retiro {day(e.terminationDate!)})
                </option>
              ))}
            </Select>
            <Select value={form.reason} onChange={(e) => setForm({ ...form, reason: e.target.value as TerminationReason })}>
              {REASONS.map((r) => (
                <option key={r.value} value={r.value}>
                  {r.label}
                </option>
              ))}
            </Select>
            {selected?.contractType === "FIXED_TERM" && form.reason === "WITHOUT_JUST_CAUSE" && (
              <Input
                label="El contrato terminaba el"
                type="date"
                value={form.fixedTermEndDate}
                onChange={(e) => setForm({ ...form, fixedTermEndDate: e.target.value })}
                required
              />
            )}
          </>
        )}
        <div className="flex items-end">
          <Button type="submit" variant="secondary" loading={previewMutation.isPending}>
            Calcular
          </Button>
        </div>
      </form>
      {type === "TERMINATION" && retired.length === 0 && (
        <p className="mb-3 text-xs text-slate-500">Primero dé de baja al empleado en Empleados, con su fecha de retiro.</p>
      )}

      {error && (
        <Alert tone="danger" className="mb-3">
          {error.message}
        </Alert>
      )}

      {preview && (
        <div className="mb-4 rounded-lg border border-slate-200 p-3">
          <p className="mb-2 text-sm font-semibold text-slate-900">{preview.description}</p>
          {preview.settlements.map((s) => (
            <div key={s.employeeId} className="mb-3">
              <p className="text-sm font-medium text-slate-800">{s.employeeName}</p>
              <Table>
                <TableHead>
                  <tr>
                    <Th>Concepto</Th>
                    <Th>Días</Th>
                    <Th>Base</Th>
                    <Th>Valor</Th>
                    <Th>Ya provisionado</Th>
                  </tr>
                </TableHead>
                <TableBody>
                  {s.lines.map((l) => (
                    <TableRow key={l.concept}>
                      <Td>{l.label}</Td>
                      <Td>{l.days}</Td>
                      <Td>{formatCOP(l.base)}</Td>
                      <Td className="font-medium">{formatCOP(l.amount)}</Td>
                      <Td className="text-slate-500">{formatCOP(l.provisioned)}</Td>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              <p className="mt-1 text-right text-sm text-slate-700">
                Total {formatCOP(s.grossTotal)}
                {s.toSeveranceFund > 0 && <> · al fondo {formatCOP(s.toSeveranceFund)}</>}
                {s.withholding > 0 && <> · retención {formatCOP(s.withholding)}</>} ·{" "}
                <b>neto al trabajador {formatCOP(s.netPay)}</b>
              </p>
              {s.notes.length > 0 && (
                <ul className="mt-1 list-disc pl-5 text-xs text-slate-500">
                  {s.notes.map((n) => (
                    <li key={n}>{n}</li>
                  ))}
                </ul>
              )}
            </div>
          ))}
          {preview.skipped.length > 0 && (
            <div className="mb-2 text-xs text-slate-500">
              No entran:{" "}
              {preview.skipped.map((s) => (
                <span key={s.employeeName} className="mr-3">
                  {s.employeeName} ({s.reason})
                </span>
              ))}
            </div>
          )}
          {preview.settlements.length > 0 && canSettle && (
            <Button loading={settleMutation.isPending} onClick={() => settleMutation.mutate()}>
              Confirmar y contabilizar
            </Button>
          )}
        </div>
      )}

      {(history?.data.length ?? 0) > 0 && (
        <>
          <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">Pagadas</h3>
          <Table>
            <TableHead>
              <tr>
                <Th>Tipo</Th>
                <Th>Empleado</Th>
                <Th>Periodo</Th>
                <Th>Total</Th>
                <Th>Neto</Th>
                <Th></Th>
              </tr>
            </TableHead>
            <TableBody>
              {history!.data.map((r) => (
                <TableRow key={r.id}>
                  <Td>{TYPE_LABELS[r.type]}</Td>
                  <Td>{employeeNames.get(r.employeeId) ?? r.detail.employeeName}</Td>
                  <Td>{r.type === "TERMINATION" ? `Retiro ${day(r.periodEnd)}` : `${day(r.periodStart)} a ${day(r.periodEnd)}`}</Td>
                  <Td>{formatCOP(r.grossTotal)}</Td>
                  <Td>{formatCOP(r.netPay)}</Td>
                  <Td className="text-right">
                    <Button
                      size="sm"
                      variant="secondary"
                      onClick={() => downloadBenefitSettlementPdf(r.id, `${r.type.toLowerCase()}-${r.detail.documentNumber}.pdf`)}
                    >
                      PDF
                    </Button>
                  </Td>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </>
      )}
    </Card>
  );
}
