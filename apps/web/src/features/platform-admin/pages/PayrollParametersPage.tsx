import { PayrollParametersCard } from "../../payroll/components/PayrollParametersCard";
import { PlatformAdminLayout } from "../components/PlatformAdminLayout";
import { createPlatformPayrollParameter, listPlatformPayrollParameters } from "../api/saas-admin.api";

/** Parametros legales de nomina por año: valen para TODAS las empresas, por eso solo se editan aqui. */
export function PayrollParametersPage() {
  return (
    <PlatformAdminLayout>
      <h1 className="mb-2 text-lg font-semibold text-slate-900">Nómina: parámetros legales</h1>
      <p className="mb-4 text-sm text-slate-600">
        Salario mínimo, auxilio de transporte, UVT y porcentajes de ley de cada año. Aplican a todas las empresas. Cree la fila
        de cada año nuevo apenas salgan los decretos (normalmente a finales de diciembre). La reforma laboral (nocturno desde
        las 7 p. m., recargo dominical y jornada de 42 h) la aplica el motor por fecha.
      </p>
      <PayrollParametersCard
        queryKey={["saas-admin", "payroll-parameters"]}
        list={listPlatformPayrollParameters}
        create={createPlatformPayrollParameter}
      />
    </PlatformAdminLayout>
  );
}
