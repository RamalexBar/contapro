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
import { listEmployees } from "../../employees/api/employee.api";
import {
  approvePayroll,
  calculatePayroll,
  cancelPayrollDeduction,
  createPayroll,
  createPayrollDeduction,
  createPayrollParameter,
  downloadPayslipPdf,
  getPayroll,
  listPayrollDeductions,
  listPayrollParameters,
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

const PARAMETER_DEFAULTS = {
  year: new Date().getFullYear(),
  effectiveFrom: `${new Date().getFullYear()}-01-01`,
  minimumWage: "1400000",
  transportAllowance: "200000",
  uvt: "49000",
  healthEmployeePercent: "4",
  healthEmployerPercent: "8.5",
  pensionEmployeePercent: "4",
  pensionEmployerPercent: "12",
  arlI: "0.522",
  arlII: "1.044",
  arlIII: "2.436",
  arlIV: "4.35",
  arlV: "6.96",
  severancePercent: "8.33",
  severanceInterestPercent: "12",
  serviceBonusPercent: "8.33",
  vacationPercent: "4.17",
  familyCompensationPercent: "4",
  icbfPercent: "3",
  senaPercent: "2",
  overtimeDayPercent: "25",
  overtimeNightPercent: "75",
  nightSurchargePercent: "35",
  sundayHolidaySurchargePercent: "75",
  monthlyHoursDivisor: "220",
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
  const { data: payrolls, isLoading } = useQuery({ queryKey: ["payrolls"], queryFn: () => listPayrolls() });
  const { data: employees } = useQuery({ queryKey: ["employees"], queryFn: () => listEmployees() });
  const employeeNames = new Map((employees?.data ?? []).map((e) => [e.id, `${e.firstName} ${e.lastName}`]));

  const [showParameterForm, setShowParameterForm] = useState(false);
  const [paramForm, setParamForm] = useState(PARAMETER_DEFAULTS);
  const createParameterMutation = useMutation({
    mutationFn: () =>
      createPayrollParameter({
        year: Number(paramForm.year),
        effectiveFrom: new Date(paramForm.effectiveFrom),
        minimumWage: Number(paramForm.minimumWage),
        transportAllowance: Number(paramForm.transportAllowance),
        uvt: Number(paramForm.uvt),
        healthEmployeePercent: Number(paramForm.healthEmployeePercent),
        healthEmployerPercent: Number(paramForm.healthEmployerPercent),
        pensionEmployeePercent: Number(paramForm.pensionEmployeePercent),
        pensionEmployerPercent: Number(paramForm.pensionEmployerPercent),
        arlPercentByRiskLevel: {
          I: Number(paramForm.arlI),
          II: Number(paramForm.arlII),
          III: Number(paramForm.arlIII),
          IV: Number(paramForm.arlIV),
          V: Number(paramForm.arlV),
        },
        severancePercent: Number(paramForm.severancePercent),
        severanceInterestPercent: Number(paramForm.severanceInterestPercent),
        serviceBonusPercent: Number(paramForm.serviceBonusPercent),
        vacationPercent: Number(paramForm.vacationPercent),
        familyCompensationPercent: Number(paramForm.familyCompensationPercent),
        icbfPercent: Number(paramForm.icbfPercent),
        senaPercent: Number(paramForm.senaPercent),
        overtimeDayPercent: Number(paramForm.overtimeDayPercent),
        overtimeNightPercent: Number(paramForm.overtimeNightPercent),
        nightSurchargePercent: Number(paramForm.nightSurchargePercent),
        sundayHolidaySurchargePercent: Number(paramForm.sundayHolidaySurchargePercent),
        monthlyHoursDivisor: Number(paramForm.monthlyHoursDivisor),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["payroll-parameters"] });
      setShowParameterForm(false);
    },
  });

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

      {canManageParameters && (
        <Card className="mb-6">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-slate-900">Parametros legales por año</h2>
            <Button size="sm" variant="secondary" onClick={() => setShowParameterForm((v) => !v)}>
              {showParameterForm ? "Cancelar" : "Nuevo parametro"}
            </Button>
          </div>

          <Table className="mb-3">
            <TableHead>
              <tr>
                <Th>Año</Th>
                <Th>Salario minimo</Th>
                <Th>Aux. transporte</Th>
                <Th>Divisor horas</Th>
              </tr>
            </TableHead>
            <TableBody>
              {parameters?.data.map((p) => (
                <TableRow key={p.id}>
                  <Td className="font-medium text-slate-900">{p.year}</Td>
                  <Td>{formatCOP(p.minimumWage)}</Td>
                  <Td>{formatCOP(p.transportAllowance)}</Td>
                  <Td>{p.monthlyHoursDivisor}</Td>
                </TableRow>
              ))}
            </TableBody>
          </Table>

          {showParameterForm && (
            <form
              className="grid grid-cols-2 gap-3 sm:grid-cols-4"
              onSubmit={(e) => {
                e.preventDefault();
                createParameterMutation.mutate();
              }}
            >
              <Input
                label="Año"
                type="number"
                value={paramForm.year}
                onChange={(e) => setParamForm({ ...paramForm, year: Number(e.target.value) })}
                required
              />
              <Input
                label="Vigente desde"
                type="date"
                value={paramForm.effectiveFrom}
                onChange={(e) => setParamForm({ ...paramForm, effectiveFrom: e.target.value })}
                required
              />
              <Input
                label="Salario minimo"
                type="number"
                value={paramForm.minimumWage}
                onChange={(e) => setParamForm({ ...paramForm, minimumWage: e.target.value })}
                required
              />
              <Input
                label="Auxilio de transporte"
                type="number"
                value={paramForm.transportAllowance}
                onChange={(e) => setParamForm({ ...paramForm, transportAllowance: e.target.value })}
                required
              />
              <Input
                label="UVT"
                type="number"
                value={paramForm.uvt}
                onChange={(e) => setParamForm({ ...paramForm, uvt: e.target.value })}
                required
              />
              <Input
                label="Salud empleado %"
                type="number"
                step="0.01"
                value={paramForm.healthEmployeePercent}
                onChange={(e) => setParamForm({ ...paramForm, healthEmployeePercent: e.target.value })}
                required
              />
              <Input
                label="Salud empleador %"
                type="number"
                step="0.01"
                value={paramForm.healthEmployerPercent}
                onChange={(e) => setParamForm({ ...paramForm, healthEmployerPercent: e.target.value })}
                required
              />
              <Input
                label="Pension empleado %"
                type="number"
                step="0.01"
                value={paramForm.pensionEmployeePercent}
                onChange={(e) => setParamForm({ ...paramForm, pensionEmployeePercent: e.target.value })}
                required
              />
              <Input
                label="Pension empleador %"
                type="number"
                step="0.01"
                value={paramForm.pensionEmployerPercent}
                onChange={(e) => setParamForm({ ...paramForm, pensionEmployerPercent: e.target.value })}
                required
              />
              <Input
                label="ARL nivel I %"
                type="number"
                step="0.001"
                value={paramForm.arlI}
                onChange={(e) => setParamForm({ ...paramForm, arlI: e.target.value })}
                required
              />
              <Input
                label="ARL nivel II %"
                type="number"
                step="0.001"
                value={paramForm.arlII}
                onChange={(e) => setParamForm({ ...paramForm, arlII: e.target.value })}
                required
              />
              <Input
                label="ARL nivel III %"
                type="number"
                step="0.001"
                value={paramForm.arlIII}
                onChange={(e) => setParamForm({ ...paramForm, arlIII: e.target.value })}
                required
              />
              <Input
                label="ARL nivel IV %"
                type="number"
                step="0.001"
                value={paramForm.arlIV}
                onChange={(e) => setParamForm({ ...paramForm, arlIV: e.target.value })}
                required
              />
              <Input
                label="ARL nivel V %"
                type="number"
                step="0.001"
                value={paramForm.arlV}
                onChange={(e) => setParamForm({ ...paramForm, arlV: e.target.value })}
                required
              />
              <Input
                label="Cesantias %"
                type="number"
                step="0.01"
                value={paramForm.severancePercent}
                onChange={(e) => setParamForm({ ...paramForm, severancePercent: e.target.value })}
                required
              />
              <Input
                label="Int. cesantias %"
                type="number"
                step="0.01"
                value={paramForm.severanceInterestPercent}
                onChange={(e) => setParamForm({ ...paramForm, severanceInterestPercent: e.target.value })}
                required
              />
              <Input
                label="Prima %"
                type="number"
                step="0.01"
                value={paramForm.serviceBonusPercent}
                onChange={(e) => setParamForm({ ...paramForm, serviceBonusPercent: e.target.value })}
                required
              />
              <Input
                label="Vacaciones %"
                type="number"
                step="0.01"
                value={paramForm.vacationPercent}
                onChange={(e) => setParamForm({ ...paramForm, vacationPercent: e.target.value })}
                required
              />
              <Input
                label="Caja compensacion %"
                type="number"
                step="0.01"
                value={paramForm.familyCompensationPercent}
                onChange={(e) => setParamForm({ ...paramForm, familyCompensationPercent: e.target.value })}
                required
              />
              <Input
                label="ICBF %"
                type="number"
                step="0.01"
                value={paramForm.icbfPercent}
                onChange={(e) => setParamForm({ ...paramForm, icbfPercent: e.target.value })}
                required
              />
              <Input
                label="SENA %"
                type="number"
                step="0.01"
                value={paramForm.senaPercent}
                onChange={(e) => setParamForm({ ...paramForm, senaPercent: e.target.value })}
                required
              />
              <Input
                label="Hora extra diurna %"
                type="number"
                step="0.01"
                value={paramForm.overtimeDayPercent}
                onChange={(e) => setParamForm({ ...paramForm, overtimeDayPercent: e.target.value })}
                required
              />
              <Input
                label="Hora extra nocturna %"
                type="number"
                step="0.01"
                value={paramForm.overtimeNightPercent}
                onChange={(e) => setParamForm({ ...paramForm, overtimeNightPercent: e.target.value })}
                required
              />
              <Input
                label="Recargo nocturno %"
                type="number"
                step="0.01"
                value={paramForm.nightSurchargePercent}
                onChange={(e) => setParamForm({ ...paramForm, nightSurchargePercent: e.target.value })}
                required
              />
              <Input
                label="Recargo dom./festivo %"
                type="number"
                step="0.01"
                value={paramForm.sundayHolidaySurchargePercent}
                onChange={(e) => setParamForm({ ...paramForm, sundayHolidaySurchargePercent: e.target.value })}
                required
              />
              <Input
                label="Divisor horas mensual"
                type="number"
                value={paramForm.monthlyHoursDivisor}
                onChange={(e) => setParamForm({ ...paramForm, monthlyHoursDivisor: e.target.value })}
                required
              />
              <div className="col-span-2 sm:col-span-4">
                <Button type="submit" loading={createParameterMutation.isPending}>
                  Guardar parametro
                </Button>
              </div>
              {createParameterMutation.isError && (
                <Alert tone="danger" className="col-span-full">
                  {(createParameterMutation.error as Error).message}
                </Alert>
              )}
            </form>
          )}
        </Card>
      )}

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
