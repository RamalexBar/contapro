import { Fragment, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { formatCOP } from "@erp/shared-utils";
import { AppLayout } from "../../../components/ui/AppLayout";
import { Card } from "../../../components/ui/Card";
import { Button } from "../../../components/ui/Button";
import { Input } from "../../../components/ui/Input";
import { useAuthStore } from "../../auth/hooks/useAuthStore";
import { listEmployees } from "../../employees/api/employee.api";
import {
  approvePayroll,
  calculatePayroll,
  createPayroll,
  createPayrollParameter,
  downloadPayslipPdf,
  getPayroll,
  listPayrollParameters,
  listPayrolls,
  payPayroll,
} from "../api/payroll.api";

const STATUS_LABEL: Record<string, string> = {
  DRAFT: "Borrador",
  CALCULATED: "Calculada",
  APPROVED: "Aprobada",
  PAID: "Pagada",
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

  return (
    <AppLayout>
      <h1 className="mb-4 text-lg font-semibold">Nomina</h1>

      {canManageParameters && (
        <Card className="mb-6">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-gray-700">Parametros legales por año</h2>
            <Button variant="secondary" onClick={() => setShowParameterForm((v) => !v)}>
              {showParameterForm ? "Cancelar" : "Nuevo parametro"}
            </Button>
          </div>

          <table className="mb-3 w-full text-left text-sm">
            <thead>
              <tr className="border-b border-gray-200 text-gray-500">
                <th className="py-2">Año</th>
                <th>Salario minimo</th>
                <th>Aux. transporte</th>
                <th>Divisor horas</th>
              </tr>
            </thead>
            <tbody>
              {parameters?.data.map((p) => (
                <tr key={p.id} className="border-b border-gray-100">
                  <td className="py-2">{p.year}</td>
                  <td>{formatCOP(p.minimumWage)}</td>
                  <td>{formatCOP(p.transportAllowance)}</td>
                  <td>{p.monthlyHoursDivisor}</td>
                </tr>
              ))}
            </tbody>
          </table>

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
                <Button type="submit" disabled={createParameterMutation.isPending}>
                  Guardar parametro
                </Button>
              </div>
              {createParameterMutation.isError && (
                <p className="col-span-full text-sm text-red-600">
                  {(createParameterMutation.error as Error).message}
                </p>
              )}
            </form>
          )}
        </Card>
      )}

      {canCreate && (
        <Card className="mb-6">
          <h2 className="mb-3 text-sm font-semibold text-gray-700">Nuevo periodo de nomina</h2>
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
              <Button type="submit" disabled={createPayrollMutation.isPending}>
                Crear periodo
              </Button>
            </div>
          </form>
          {createPayrollMutation.isError && (
            <p className="mt-2 text-sm text-red-600">{(createPayrollMutation.error as Error).message}</p>
          )}
        </Card>
      )}

      <Card>
        <h2 className="mb-3 text-sm font-semibold text-gray-700">Periodos de nomina</h2>
        {isLoading && <p className="text-sm text-gray-500">Cargando...</p>}
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-gray-200 text-gray-500">
              <th className="py-2">Periodo</th>
              <th>Tipo</th>
              <th>Fechas</th>
              <th>Estado</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {payrolls?.data.map((payroll) => (
              <Fragment key={payroll.id}>
                <tr className="border-b border-gray-100">
                  <td className="py-2">
                    {payroll.month}/{payroll.year}
                  </td>
                  <td>{payroll.periodType === "MONTHLY" ? "Mensual" : "Quincenal"}</td>
                  <td>
                    {payroll.startDate.slice(0, 10)} a {payroll.endDate.slice(0, 10)}
                  </td>
                  <td>{STATUS_LABEL[payroll.status] ?? payroll.status}</td>
                  <td className="space-x-2 py-2 text-right">
                    <Button
                      variant="secondary"
                      onClick={() => setExpandedId(expandedId === payroll.id ? null : payroll.id)}
                    >
                      {expandedId === payroll.id ? "Ocultar" : "Ver detalle"}
                    </Button>
                    {canCalculate && (payroll.status === "DRAFT" || payroll.status === "CALCULATED") && (
                      <Button
                        onClick={() => calculateMutation.mutate(payroll.id)}
                        disabled={calculateMutation.isPending}
                      >
                        Calcular
                      </Button>
                    )}
                    {canApprove && payroll.status === "CALCULATED" && (
                      <Button onClick={() => approveMutation.mutate(payroll.id)} disabled={approveMutation.isPending}>
                        Aprobar
                      </Button>
                    )}
                    {canPay && payroll.status === "APPROVED" && (
                      <Button onClick={() => payMutation.mutate(payroll.id)} disabled={payMutation.isPending}>
                        Pagar
                      </Button>
                    )}
                  </td>
                </tr>
                {expandedId === payroll.id && expandedPayroll && (
                  <tr>
                    <td colSpan={5} className="bg-gray-50 px-2 py-3">
                      <table className="w-full text-left text-xs">
                        <thead>
                          <tr className="text-gray-500">
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
                            <tr key={detail.id} className="border-t border-gray-200">
                              <td className="py-1">{employeeNames.get(detail.employeeId) ?? detail.employeeId}</td>
                              <td>{formatCOP(detail.grossTotal)}</td>
                              <td>{formatCOP(detail.totalDeductions)}</td>
                              <td className="font-semibold">{formatCOP(detail.netPay)}</td>
                              <td>{formatCOP(detail.employerCostTotal)}</td>
                              <td className="text-right">
                                {detail.payslip && (
                                  <Button
                                    variant="secondary"
                                    disabled={downloadPayslipMutation.isPending}
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
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                      {expandedPayroll.details.length === 0 && (
                        <p className="py-2 text-xs text-gray-400">
                          Este periodo aun no se ha calculado.
                        </p>
                      )}
                    </td>
                  </tr>
                )}
              </Fragment>
            ))}
          </tbody>
        </table>
        {payrolls?.data.length === 0 && <p className="py-4 text-sm text-gray-400">No hay periodos de nomina.</p>}
      </Card>
    </AppLayout>
  );
}
