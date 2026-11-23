import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { CreatePayrollParameterInput } from "@erp/shared-types";
import { formatCOP } from "@erp/shared-utils";
import { Card } from "../../../components/ui/Card";
import { Button } from "../../../components/ui/Button";
import { Input } from "../../../components/ui/Input";
import { Table, TableHead, TableBody, TableRow, Th, Td } from "../../../components/ui/Table";
import { Alert } from "../../../components/ui/Alert";
import type { PayrollParameterRecord } from "../api/payroll.api";

const PARAMETER_DEFAULTS = {
  year: new Date().getFullYear(),
  effectiveFrom: `${new Date().getFullYear()}-01-01`,
  // Valores oficiales 2026 (Decretos 1469/1470 de 2025 y Resolucion DIAN 000238 de 2025).
  minimumWage: "1750905",
  transportAllowance: "249095",
  uvt: "52374",
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
  sundayHolidaySurchargePercent: "80",
  monthlyHoursDivisor: "220",
};

/**
 * Parametros legales de nomina por año. La tabla es GLOBAL (la misma legislacion para todas las
 * empresas), asi que solo el panel de plataforma la edita (prop `create`); en cada empresa se
 * muestra solo para consulta.
 */
export function PayrollParametersCard({
  queryKey,
  list,
  create,
}: {
  queryKey: readonly unknown[];
  list: () => Promise<{ data: PayrollParameterRecord[] }>;
  create?: (input: CreatePayrollParameterInput) => Promise<unknown>;
}) {
  const queryClient = useQueryClient();
  const { data: parameters } = useQuery({ queryKey, queryFn: list });
  const [showParameterForm, setShowParameterForm] = useState(false);
  const [paramForm, setParamForm] = useState(PARAMETER_DEFAULTS);
  const createParameterMutation = useMutation({
    mutationFn: () =>
      create!({
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
      queryClient.invalidateQueries({ queryKey });
      setShowParameterForm(false);
    },
  });

  return (
          <Card className="mb-6">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-sm font-semibold text-slate-900">Parametros legales por año</h2>
              {create ? (
                <Button size="sm" variant="secondary" onClick={() => setShowParameterForm((v) => !v)}>
                  {showParameterForm ? "Cancelar" : "Nuevo parametro"}
                </Button>
              ) : (
                <span className="text-xs text-slate-500">Los publica Contapro para todas las empresas</span>
              )}
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

            {create && showParameterForm && (
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
  );
}
