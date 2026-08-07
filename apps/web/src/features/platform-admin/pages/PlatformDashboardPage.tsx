import { useQuery } from "@tanstack/react-query";
import { formatCOP } from "@erp/shared-utils";
import { Card } from "../../../components/ui/Card";
import { Spinner } from "../../../components/ui/Spinner";
import { PlatformAdminLayout } from "../components/PlatformAdminLayout";
import { getSaasDashboard } from "../api/saas-admin.api";

const STATUS_LABELS: Record<string, string> = {
  TRIALING: "En prueba",
  ACTIVE: "Activas",
  GRACE_PERIOD: "Periodo de gracia",
  SUSPENDED: "Suspendidas",
  CANCELLED: "Canceladas",
};

export function PlatformDashboardPage() {
  const { data, isLoading } = useQuery({ queryKey: ["saas-admin", "dashboard"], queryFn: getSaasDashboard });

  return (
    <PlatformAdminLayout>
      <h1 className="mb-4 text-lg font-semibold text-slate-900">Dashboard</h1>
      {isLoading && <Spinner />}
      {data && (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
          {Object.entries(data.companiesByStatus).map(([status, count]) => (
            <Card key={status}>
              <p className="text-xs text-slate-500">{STATUS_LABELS[status] ?? status}</p>
              <p className="text-2xl font-semibold text-slate-900">{count}</p>
            </Card>
          ))}
          <Card>
            <p className="text-xs text-slate-500">Proximas a vencer (8 dias)</p>
            <p className="text-2xl font-semibold text-slate-900">{data.upcomingRenewals}</p>
          </Card>
          <Card>
            <p className="text-xs text-slate-500">Ingresos confirmados este mes</p>
            <p className="text-2xl font-semibold text-slate-900">{formatCOP(data.monthlyRevenueConfirmed)}</p>
          </Card>
        </div>
      )}
    </PlatformAdminLayout>
  );
}
