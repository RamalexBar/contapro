import { useQuery } from "@tanstack/react-query";
import { formatCOP } from "@erp/shared-utils";
import { AlertCircle, Banknote, DollarSign, PackageX, ReceiptText, TrendingUp, UserPlus, Wallet } from "lucide-react";
import { getDashboardMetrics } from "../api/dashboard.api";
import { StatCard } from "../components/StatCard";
import { AppLayout } from "../../../components/ui/AppLayout";
import { Spinner } from "../../../components/ui/Spinner";
import { Alert } from "../../../components/ui/Alert";

export function DashboardPage() {
  const { data, isLoading, error } = useQuery({ queryKey: ["dashboard-metrics"], queryFn: getDashboardMetrics });

  return (
    <AppLayout>
      <h1 className="mb-4 text-lg font-semibold text-slate-900">Dashboard</h1>
      {isLoading && <Spinner />}
      {error && (
        <Alert tone="danger">
          <span className="flex items-center gap-1.5">
            <AlertCircle size={14} /> No se pudo cargar el dashboard
          </span>
        </Alert>
      )}
      {data && (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard
            label="Ventas de hoy"
            value={formatCOP(data.salesToday.total)}
            hint={`${data.salesToday.count} ventas`}
            icon={DollarSign}
          />
          <StatCard
            label="Ventas del mes"
            value={formatCOP(data.salesMonth.total)}
            hint={`${data.salesMonth.count} ventas`}
            icon={TrendingUp}
          />
          <StatCard label="Utilidad estimada del mes" value={formatCOP(data.estimatedProfitMonth)} icon={Banknote} />
          <StatCard
            label="Caja activa"
            value={data.activeCashSession ? formatCOP(data.activeCashSession.openingAmount) : "Sin abrir"}
            hint={data.activeCashSession?.cashRegisterName}
            icon={Wallet}
          />
          <StatCard label="Productos agotados" value={data.outOfStockCount} icon={PackageX} />
          <StatCard label="Facturas pendientes" value={data.pendingInvoices} icon={ReceiptText} />
          <StatCard label="Clientes nuevos (mes)" value={data.newCustomersMonth} icon={UserPlus} />
          <StatCard label="Productos mas vendidos" value={data.topProducts[0]?.name ?? "-"} />
        </div>
      )}
    </AppLayout>
  );
}
