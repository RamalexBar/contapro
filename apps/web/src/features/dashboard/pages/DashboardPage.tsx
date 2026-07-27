import { useQuery } from "@tanstack/react-query";
import { formatCOP } from "@erp/shared-utils";
import { getDashboardMetrics } from "../api/dashboard.api";
import { StatCard } from "../components/StatCard";
import { AppLayout } from "../../../components/ui/AppLayout";

export function DashboardPage() {
  const { data, isLoading, error } = useQuery({ queryKey: ["dashboard-metrics"], queryFn: getDashboardMetrics });

  return (
    <AppLayout>
      <h1 className="mb-4 text-lg font-semibold">Dashboard</h1>
      {isLoading && <p className="text-sm text-gray-500">Cargando...</p>}
      {error && <p className="text-sm text-red-600">No se pudo cargar el dashboard</p>}
      {data && (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard label="Ventas de hoy" value={formatCOP(data.salesToday.total)} hint={`${data.salesToday.count} ventas`} />
          <StatCard label="Ventas del mes" value={formatCOP(data.salesMonth.total)} hint={`${data.salesMonth.count} ventas`} />
          <StatCard label="Utilidad estimada del mes" value={formatCOP(data.estimatedProfitMonth)} />
          <StatCard
            label="Caja activa"
            value={data.activeCashSession ? formatCOP(data.activeCashSession.openingAmount) : "Sin abrir"}
            hint={data.activeCashSession?.cashRegisterName}
          />
          <StatCard label="Productos agotados" value={data.outOfStockCount} />
          <StatCard label="Facturas pendientes" value={data.pendingInvoices} />
          <StatCard label="Clientes nuevos (mes)" value={data.newCustomersMonth} />
          <StatCard label="Productos mas vendidos" value={data.topProducts[0]?.name ?? "-"} />
        </div>
      )}
    </AppLayout>
  );
}
