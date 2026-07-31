import { useQuery } from "@tanstack/react-query";
import { Card } from "../../../components/ui/Card";
import { PlatformAdminLayout } from "../components/PlatformAdminLayout";
import { listCompanies } from "../api/saas-admin.api";

export function CompaniesPage() {
  const { data, isLoading } = useQuery({ queryKey: ["saas-admin", "companies"], queryFn: listCompanies });

  return (
    <PlatformAdminLayout>
      <h1 className="mb-4 text-lg font-semibold">Empresas</h1>
      <Card>
        {isLoading && <p className="text-sm text-gray-500">Cargando...</p>}
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-gray-200 text-gray-500">
              <th className="py-2">Empresa</th>
              <th>NIT</th>
              <th>Activa</th>
              <th>Suscripcion</th>
              <th>Plan</th>
              <th>Vence</th>
            </tr>
          </thead>
          <tbody>
            {data?.data.map((c) => (
              <tr key={c.companyId} className="border-b border-gray-100">
                <td className="py-2">{c.companyName}</td>
                <td>{c.nit}</td>
                <td>{c.isActive ? "Si" : "No"}</td>
                <td>{c.subscriptionStatus ?? "-"}</td>
                <td>{c.planName ?? "-"}</td>
                <td>{c.currentPeriodEnd ? c.currentPeriodEnd.slice(0, 10) : "-"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    </PlatformAdminLayout>
  );
}
