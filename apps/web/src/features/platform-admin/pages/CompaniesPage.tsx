import { useQuery } from "@tanstack/react-query";
import { Card } from "../../../components/ui/Card";
import { Table, TableHead, TableBody, TableRow, Th, Td } from "../../../components/ui/Table";
import { Badge } from "../../../components/ui/Badge";
import { Spinner } from "../../../components/ui/Spinner";
import { PlatformAdminLayout } from "../components/PlatformAdminLayout";
import { listCompanies } from "../api/saas-admin.api";

export function CompaniesPage() {
  const { data, isLoading } = useQuery({ queryKey: ["saas-admin", "companies"], queryFn: listCompanies });

  return (
    <PlatformAdminLayout>
      <h1 className="mb-4 text-lg font-semibold text-slate-900">Empresas</h1>
      <Card noPadding>
        {isLoading ? (
          <Spinner />
        ) : (
          <Table>
            <TableHead>
              <tr>
                <Th>Empresa</Th>
                <Th>NIT</Th>
                <Th>Activa</Th>
                <Th>Suscripcion</Th>
                <Th>Plan</Th>
                <Th>Vence</Th>
              </tr>
            </TableHead>
            <TableBody>
              {data?.data.map((c) => (
                <TableRow key={c.companyId}>
                  <Td>{c.companyName}</Td>
                  <Td>{c.nit}</Td>
                  <Td>
                    <Badge tone={c.isActive ? "success" : "neutral"}>{c.isActive ? "Si" : "No"}</Badge>
                  </Td>
                  <Td>{c.subscriptionStatus ?? "-"}</Td>
                  <Td>{c.planName ?? "-"}</Td>
                  <Td>{c.currentPeriodEnd ? c.currentPeriodEnd.slice(0, 10) : "-"}</Td>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </Card>
    </PlatformAdminLayout>
  );
}
