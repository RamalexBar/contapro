import { Fragment, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { formatCOP } from "@erp/shared-utils";
import { AppLayout } from "../../../components/ui/AppLayout";
import { Card } from "../../../components/ui/Card";
import { Button } from "../../../components/ui/Button";
import { Input } from "../../../components/ui/Input";
import { Table, TableHead, TableBody, TableRow, Th, Td } from "../../../components/ui/Table";
import { Badge } from "../../../components/ui/Badge";
import { Alert } from "../../../components/ui/Alert";
import { Spinner } from "../../../components/ui/Spinner";
import { useAuthStore } from "../../auth/hooks/useAuthStore";
import { PayrollParametersCard } from "../components/PayrollParametersCard";
import { listEmployees } from "../../employees/api/employee.api";
import {
  approvePayroll,
  calculatePayroll,
  cancelPayrollDeduction,
  createPayroll,
  createPayrollDeduction,
  downloadPayslipPdf,
  getPayroll,
  listPayrollDeductions,
  listPayrollParameters,
  getPayrollSettings,
  updatePayrollSettings,
  listPayrolls,
  listPayslipWhatsAppDeliveries,
  payPayroll,
  resendPayslipWhatsApp,
} from "../api/payroll.api";

const STATUS_LABEL: Record<string, string> = {
  DRAFT: "Borrador",
  CALCULATED: "Calculada",
  APPROVED: "Aprobada",
  PAID: "Pagada",
};

const DEDUCTION_TYPE_LABEL: Record<string, string> = {
  LOAN_DEDUCTION: "Libranza",
  GARNISHMENT: "Embargo",
};

const DEDUCTION_STATUS_LABEL: Record<string, string> = {
  ACTIVE: "Activa",
  COMPLETED: "Completada",
  CANCELLED: "Cancelada",
};

const EMPTY_DEDUCTION_FORM = {
  employeeId: "",
  type: "LOAN_DEDUCTION" as "LOAN_DEDUCTION" | "GARNISHMENT",
  description: "",
  amountPerPeriod: "",
  totalAmount: "",
  startDate: "",
};


const EMPTY_PAYROLL_FORM = {
  year: new Date().getFullYear(),
  month: new Date().getMonth() + 1,
  periodType: "MONTHLY" as "MONTHLY" | "BIWEEKLY",
  startDate: "",
  endDate: "",
};

export function PayrollPage() {
  const queryClient = useQueryClient();
  const canManageParameters = useAuthStore((s) => s.hasPermission("payroll.parameter.manage"));
  const canCreate = useAuthStore((s) => s.hasPermission("payroll.create"));
  const canCalculate = useAuthStore((s) => s.hasPermission("payroll.calculate"));
  const canApprove = useAuthStore((s) => s.hasPermission("payroll.approve"));
  const canPay = useAuthStore((s) => s.hasPermission("payroll.pay"));
  const canManageDeductions = useAuthStore((s) => s.hasPermission("payroll.deduction.manage"));

  const { data: parameters } = useQuery({ queryKey: ["payroll-parameters"], queryFn: listPayrollParameters });
  const { data: settings } = useQuery({ queryKey: ["payroll-settings"], queryFn: getPayrollSettings });
  const settingsMutation = useMutation({
    mutationFn: (exemptArt1141: boolean) => updatePayrollSettings({ exemptArt1141 }),
    onSuccess: (data) => queryClient.setQueryData(["payroll-settings"], data),
  });
  const { data: payrolls, isLoading } = useQuery({ queryKey: ["payrolls"], queryFn: () => listPayrolls() });
  const { data: employees } = useQuery({ queryKey: ["employees"], queryFn: () => listEmployees() });
  const employeeNames = new Map((employees?.data ?? []).map((e) => [e.id, `${e.firstName} ${e.lastName}`]));


  const [payrollForm, setPayrollForm] = useState(EMPTY_PAYROLL_FORM);
  const createPayrollMutation = useMutation({
    mutationFn: () =>
      createPayroll({
        year: Number(payrollForm.year),
        month: Number(payrollForm.month),
        periodType: payrollForm.periodType,
        startDate: new Date(payrollForm.startDate),
        endDate: new Date(payrollForm.endDate),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["payrolls"] });
      setPayrollForm(EMPTY_PAYROLL_FORM);
    },
  });

  const calculateMutation = useMutation({
    mutationFn: (id: string) => calculatePayroll(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["payrolls"] }),
  });
  const approveMutation = useMutation({
    mutationFn: (id: string) => approvePayroll(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["payrolls"] }),
  });
  const payMutation = useMutation({
    mutationFn: (id: string) => payPayroll(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["payrolls"] }),
  });
  const downloadPayslipMutation = useMutation({
    mutationFn: ({ payslipId, fileName }: { payslipId: string; fileName: string }) =>
      downloadPayslipPdf(payslipId, fileName),
  });

  const [expandedId, setExpandedId] = useState<string | null>(null);
  const { data: expandedPayroll } = useQuery({
    queryKey: ["payroll", expandedId],
    queryFn: () => getPayroll(expandedId as string),
    enabled: Boolean(expandedId),
  });

  const { data: deductions } = useQuery({ queryKey: ["payroll-deductions"], queryFn: () => listPayrollDeductions() });
  const [showDeductionForm, setShowDeductionForm] = useState(false);
  const [deductionForm, setDeductionForm] = useState(EMPTY_DEDUCTION_FORM);
  const createDeductionMutation = useMutation({
    mutationFn: () =>
      createPayrollDeduction({
        employeeId: deductionForm.employeeId,
        type: deductionForm.type,
        description: deductionForm.description,
        amountPerPeriod: Number(deductionForm.amountPerPeriod),
        totalAmount: deductionForm.totalAmount ? Number(deductionForm.totalAmount) : undefined,
        startDate: new Date(deductionForm.startDate),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["payroll-deductions"] });
      setDeductionForm(EMPTY_DEDUCTION_FORM);
      setShowDeductionForm(false);
    },
  });
  const cancelDeductionMutation = useMutation({
    mutationFn: (id: string) => cancelPayrollDeduction(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["payroll-deductions"] }),
  });

  return (
    <AppLayout>
      <h1 className="mb-4 text-lg font-semibold text-slate-900">Nomina</h1>

      {canManageParameters && settings && (
        <Card className="mb-6">
          <h2 className="mb-2 text-sm font-semibold text-slate-900">Configuracion de la empresa</h2>
          <label className="flex items-start gap-3 text-sm text-slate-700">
            <input
              type="checkbox"
              className="mt-1"
              checked={settings.exemptArt1141}
              disabled={settingsMutation.isPending}
              onChange={(e) => settingsMutation.mutate(e.target.checked)}
            />
            <span>
              <span className="font-medium text-slate-900">Exonerada de aportes (art. 114-1 del Estatuto Tributario)</span>
              <br />
              No paga salud del empleador (8,5%), SENA (2%) ni ICBF (3%) por los trabajadores que ganan menos de 10
              salarios minimos. Aplica a sociedades y personas juridicas declarantes de renta, personas naturales con 2 o
              mas trabajadores y contribuyentes del regimen SIMPLE. No aplica a entidades sin animo de lucro ni a personas
              naturales con un solo trabajador. Confirmelo con su contador. Se aplica al calcular (o recalcular) la nomina.
            </span>
          </label>
          <p className="mt-3 text-xs text-slate-500">
            La reforma laboral se aplica sola segun la fecha: jornada nocturna desde las 7 p. m. (desde el 25/12/2025),
            recargo dominical y festivo de 80% / 90% (desde el 01/07/2026) / 100% (desde el 01/07/2027) y jornada de 42
            horas (divisor 210, desde el 15/07/2026).
          </p>
        </Card>
      )}

      <PayrollParametersCard queryKey={["payroll-parameters"]} list={listPayrollParameters} />

      {canCreate && (
        <Card className="mb-6">
          <h2 className="mb-3 text-sm font-semibold text-slate-900">Nuevo periodo de nomina</h2>
          <form
            className="grid grid-cols-2 gap-3 sm:grid-cols-5"
            onSubmit={(e) => {
              e.preventDefault();
              createPayrollMutation.mutate();
            }}
          >
            <Input
              label="Año"
              type="number"
              value={payrollForm.year}
              onChange={(e) => setPayrollForm({ ...payrollForm, year: Number(e.target.value) })}
              required
            />
            <Input
              label="Mes (1-12)"
              type="number"
              min={1}
              max={12}
              value={payrollForm.month}
              onChange={(e) => setPayrollForm({ ...payrollForm, month: Number(e.target.value) })}
              required
            />
            <Input
              label="Inicio"
              type="date"
              value={payrollForm.startDate}
              onChange={(e) => setPayrollForm({ ...payrollForm, startDate: e.target.value })}
              required
            />
            <Input
              label="Fin"
              type="date"
              value={payrollForm.endDate}
              onChange={(e) => setPayrollForm({ ...payrollForm, endDate: e.target.value })}
              required
            />
            <div className="self-end">
              <Button type="submit" loading={createPayrollMutation.isPending}>
                Crear periodo
              </Button>
            </div>
          </form>
          {createPayrollMutation.isError && (
            <Alert tone="danger" className="mt-2">
              {(createPayrollMutation.error as Error).message}
            </Alert>
          )}
        </Card>
      )}

      {(canManageDeductions || (deductions?.data.length ?? 0) > 0) && (
        <Card className="mb-6">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-slate-900">Deducciones recurrentes (libranzas/embargos)</h2>
            {canManageDeductions && (
              <Button size="sm" variant="secondary" onClick={() => setShowDeductionForm((v) => !v)}>
                {showDeductionForm ? "Cancelar" : "Nueva deduccion"}
              </Button>
            )}
          </div>

          {showDeductionForm && canManageDeductions && (
            <form
              className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-6"
              onSubmit={(e) => {
                e.preventDefault();
                createDeductionMutation.mutate();
              }}
            >
              <div className="col-span-2 sm:col-span-2">
                <label className="mb-1 block text-sm font-medium text-slate-700">Empleado</label>
                <select
                  className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
                  value={deductionForm.employeeId}
                  onChange={(e) => setDeductionForm({ ...deductionForm, employeeId: e.target.value })}
                  required
                >
                  <option value="">Seleccionar...</option>
                  {employees?.data.map((emp) => (
                    <option key={emp.id} value={emp.id}>
                      {emp.firstName} {emp.lastName}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">Tipo</label>
                <select
                  className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
                  value={deductionForm.type}
                  onChange={(e) => setDeductionForm({ ...deductionForm, type: e.target.value as "LOAN_DEDUCTION" | "GARNISHMENT" })}
                >
                  <option value="LOAN_DEDUCTION">Libranza</option>
                  <option value="GARNISHMENT">Embargo</option>
                </select>
              </div>
              <Input
                label="Descripcion"
                value={deductionForm.description}
                onChange={(e) => setDeductionForm({ ...deductionForm, description: e.target.value })}
                required
              />
              <Input
                label="Cuota por periodo"
                type="number"
                value={deductionForm.amountPerPeriod}
                onChange={(e) => setDeductionForm({ ...deductionForm, amountPerPeriod: e.target.value })}
                required
              />
              <Input
                label="Monto total (opcional)"
                type="number"
                hint="Vacio = indefinida hasta cancelar"
                value={deductionForm.totalAmount}
                onChange={(e) => setDeductionForm({ ...deductionForm, totalAmount: e.target.value })}
              />
              <Input
                label="Fecha inicio"
                type="date"
                value={deductionForm.startDate}
                onChange={(e) => setDeductionForm({ ...deductionForm, startDate: e.target.value })}
                required
              />
              <div className="col-span-full">
                <Button type="submit" loading={createDeductionMutation.isPending}>
                  Guardar deduccion
                </Button>
              </div>
              {createDeductionMutation.isError && (
                <Alert tone="danger" className="col-span-full">
                  {(createDeductionMutation.error as Error).message}
                </Alert>
              )}
            </form>
          )}

          {(deductions?.data.length ?? 0) > 0 ? (
            <Table>
              <TableHead>
                <tr>
                  <Th>Empleado</Th>
                  <Th>Tipo</Th>
                  <Th>Descripcion</Th>
                  <Th>Cuota/periodo</Th>
                  <Th>Saldo</Th>
                  <Th>Estado</Th>
                  <Th></Th>
                </tr>
              </TableHead>
              <TableBody>
                {deductions?.data.map((d) => (
                  <TableRow key={d.id}>
                    <Td>{employeeNames.get(d.employeeId) ?? d.employeeId}</Td>
                    <Td>{DEDUCTION_TYPE_LABEL[d.type] ?? d.type}</Td>
                    <Td>{d.description}</Td>
                    <Td>{formatCOP(d.amountPerPeriod)}</Td>
                    <Td>{d.remainingBalance !== null ? formatCOP(d.remainingBalance) : "Indefinida"}</Td>
                    <Td>
                      <Badge tone={d.status === "ACTIVE" ? "success" : d.status === "COMPLETED" ? "info" : "neutral"}>
                        {DEDUCTION_STATUS_LABEL[d.status] ?? d.status}
                      </Badge>
                    </Td>
                    <Td className="text-right">
                      {canManageDeductions && d.status === "ACTIVE" && (
                        <Button
                          size="sm"
                          variant="secondary"
                          loading={cancelDeductionMutation.isPending && cancelDeductionMutation.variables === d.id}
                          onClick={() => cancelDeductionMutation.mutate(d.id)}
                        >
                          Cancelar
                        </Button>
                      )}
                    </Td>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <p className="text-sm text-slate-400">Sin deducciones recurrentes registradas.</p>
          )}
        </Card>
      )}

      <Card title="Periodos de nomina" noPadding>
        {isLoading ? (
          <Spinner />
        ) : (
          <Table>
            <TableHead>
              <tr>
                <Th>Periodo</Th>
                <Th>Tipo</Th>
                <Th>Fechas</Th>
                <Th>Estado</Th>
                <Th></Th>
              </tr>
            </TableHead>
            <TableBody>
              {payrolls?.data.map((payroll) => (
                <Fragment key={payroll.id}>
                  <TableRow>
                    <Td className="font-medium text-slate-900">
                      {payroll.month}/{payroll.year}
                    </Td>
                    <Td>{payroll.periodType === "MONTHLY" ? "Mensual" : "Quincenal"}</Td>
                    <Td>
                      {payroll.startDate.slice(0, 10)} a {payroll.endDate.slice(0, 10)}
                    </Td>
                    <Td>
                      <Badge tone={payroll.status === "PAID" ? "success" : payroll.status === "DRAFT" ? "neutral" : "info"}>
                        {STATUS_LABEL[payroll.status] ?? payroll.status}
                      </Badge>
                    </Td>
                    <Td className="space-x-2 text-right">
                      <Button size="sm" variant="secondary" onClick={() => setExpandedId(expandedId === payroll.id ? null : payroll.id)}>
                        {expandedId === payroll.id ? "Ocultar" : "Ver detalle"}
                      </Button>
                      {canCalculate && (payroll.status === "DRAFT" || payroll.status === "CALCULATED") && (
                        <Button size="sm" onClick={() => calculateMutation.mutate(payroll.id)} loading={calculateMutation.isPending}>
                          Calcular
                        </Button>
                      )}
                      {canApprove && payroll.status === "CALCULATED" && (
                        <Button size="sm" onClick={() => approveMutation.mutate(payroll.id)} loading={approveMutation.isPending}>
                          Aprobar
                        </Button>
                      )}
                      {canPay && payroll.status === "APPROVED" && (
                        <Button size="sm" onClick={() => payMutation.mutate(payroll.id)} loading={payMutation.isPending}>
                          Pagar
                        </Button>
                      )}
                    </Td>
                  </TableRow>
                  {expandedId === payroll.id && expandedPayroll && (
                    <tr>
                      <td colSpan={5} className="bg-slate-50 px-2 py-3">
                        <table className="w-full text-left text-xs">
                          <thead>
                            <tr className="text-slate-500">
                              <th className="py-1">Empleado</th>
                              <th>Devengado</th>
                              <th>Deducciones</th>
                              <th>Neto a pagar</th>
                              <th>Costo empleador</th>
                              <th></th>
                            </tr>
                          </thead>
                          <tbody>
                            {expandedPayroll.details.map((detail) => (
                              <tr key={detail.id} className="border-t border-slate-200">
                                <td className="py-1">{employeeNames.get(detail.employeeId) ?? detail.employeeId}</td>
                                <td>{formatCOP(detail.grossTotal)}</td>
                                <td>{formatCOP(detail.totalDeductions)}</td>
                                <td className="font-semibold text-slate-900">{formatCOP(detail.netPay)}</td>
                                <td>{formatCOP(detail.employerCostTotal)}</td>
                                <td className="text-right">
                                  {detail.payslip && (
                                    <Button
                                      size="sm"
                                      variant="secondary"
                                      loading={downloadPayslipMutation.isPending}
                                      onClick={() =>
                                        downloadPayslipMutation.mutate({
                                          payslipId: detail.payslip!.id,
                                          fileName: `desprendible-${(employeeNames.get(detail.employeeId) ?? detail.employeeId).replace(/\s+/g, "-")}-${payroll.month}-${payroll.year}.pdf`,
                                        })
                                      }
                                    >
                                      Desprendible PDF
                                    </Button>
                                  )}
                                  {detail.payslip && <PayslipWhatsAppStatus payslipId={detail.payslip.id} />}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                        {expandedPayroll.details.length === 0 && (
                          <p className="py-2 text-xs text-slate-400">Este periodo aun no se ha calculado.</p>
                        )}
                      </td>
                    </tr>
                  )}
                </Fragment>
              ))}
            </TableBody>
          </Table>
        )}
        {payrolls?.data.length === 0 && <p className="p-4 text-sm text-slate-400">No hay periodos de nomina.</p>}
      </Card>
    </AppLayout>
  );
}

/** Item 41 de docs/ALCANCE.md: estado de envio del desprendible por WhatsApp + reenvio manual. */
function PayslipWhatsAppStatus({ payslipId }: { payslipId: string }) {
  const hasPermission = useAuthStore((s) => s.hasPermission);
  const queryClient = useQueryClient();
  const { data } = useQuery({
    queryKey: ["payslip-whatsapp-deliveries", payslipId],
    queryFn: () => listPayslipWhatsAppDeliveries(payslipId),
  });
  const resendMutation = useMutation({
    mutationFn: () => resendPayslipWhatsApp(payslipId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["payslip-whatsapp-deliveries", payslipId] }),
  });

  const latest = data?.data[0];
  if (!latest) return null;

  return (
    <div className="mt-1 text-xs text-slate-500">
      {latest.success ? (
        "Enviado por WhatsApp"
      ) : (
        <>
          <span>Fallo el envio por WhatsApp</span>
          {hasPermission("payroll.approve") && (
            <Button size="sm" variant="secondary" loading={resendMutation.isPending} onClick={() => resendMutation.mutate()} className="ml-2">
              Reenviar
            </Button>
          )}
        </>
      )}
    </div>
  );
}
