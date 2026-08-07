import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { formatCOP } from "@erp/shared-utils";
import { Card } from "../../../components/ui/Card";
import { Button } from "../../../components/ui/Button";
import { Input } from "../../../components/ui/Input";
import { Table, TableHead, TableBody, TableRow, Th, Td } from "../../../components/ui/Table";
import { Badge } from "../../../components/ui/Badge";
import { Alert } from "../../../components/ui/Alert";
import { Spinner } from "../../../components/ui/Spinner";
import { PlatformAdminLayout } from "../components/PlatformAdminLayout";
import { createPlan, listPlans } from "../api/saas-admin.api";

export function PlansPage() {
  const queryClient = useQueryClient();
  const { data, isLoading } = useQuery({ queryKey: ["saas-admin", "plans"], queryFn: listPlans });
  const [form, setForm] = useState({ code: "", name: "", priceMonthly: "", priceYearly: "", maxBranches: "1", maxUsers: "3" });

  const createMutation = useMutation({
    mutationFn: () =>
      createPlan({
        code: form.code,
        name: form.name,
        priceMonthly: Number(form.priceMonthly),
        priceYearly: Number(form.priceYearly),
        maxBranches: Number(form.maxBranches),
        maxUsers: Number(form.maxUsers),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["saas-admin", "plans"] });
      setForm({ code: "", name: "", priceMonthly: "", priceYearly: "", maxBranches: "1", maxUsers: "3" });
    },
  });

  return (
    <PlatformAdminLayout>
      <h1 className="mb-4 text-lg font-semibold text-slate-900">Planes</h1>

      <Card title="Nuevo plan" className="mb-6">
        <form
          className="grid grid-cols-2 gap-3 sm:grid-cols-6"
          onSubmit={(e) => {
            e.preventDefault();
            createMutation.mutate();
          }}
        >
          <Input placeholder="Codigo" value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })} required />
          <Input placeholder="Nombre" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
          <Input
            type="number"
            placeholder="Precio mensual"
            value={form.priceMonthly}
            onChange={(e) => setForm({ ...form, priceMonthly: e.target.value })}
            required
          />
          <Input
            type="number"
            placeholder="Precio anual"
            value={form.priceYearly}
            onChange={(e) => setForm({ ...form, priceYearly: e.target.value })}
            required
          />
          <Input
            type="number"
            placeholder="Max. sucursales"
            value={form.maxBranches}
            onChange={(e) => setForm({ ...form, maxBranches: e.target.value })}
            required
          />
          <Input
            type="number"
            placeholder="Max. usuarios"
            value={form.maxUsers}
            onChange={(e) => setForm({ ...form, maxUsers: e.target.value })}
            required
          />
          <Button type="submit" loading={createMutation.isPending}>
            Crear
          </Button>
        </form>
        {createMutation.isError && (
          <Alert tone="danger" className="mt-2">
            {(createMutation.error as Error).message}
          </Alert>
        )}
      </Card>

      <Card noPadding>
        {isLoading ? (
          <Spinner />
        ) : (
          <Table>
            <TableHead>
              <tr>
                <Th>Codigo</Th>
                <Th>Nombre</Th>
                <Th>Mensual</Th>
                <Th>Anual</Th>
                <Th>Max. sucursales</Th>
                <Th>Max. usuarios</Th>
                <Th>Activo</Th>
              </tr>
            </TableHead>
            <TableBody>
              {data?.data.map((p) => (
                <TableRow key={p.id}>
                  <Td>{p.code}</Td>
                  <Td>{p.name}</Td>
                  <Td>{formatCOP(p.priceMonthly)}</Td>
                  <Td>{formatCOP(p.priceYearly)}</Td>
                  <Td>{p.maxBranches}</Td>
                  <Td>{p.maxUsers}</Td>
                  <Td>
                    <Badge tone={p.isActive ? "success" : "neutral"}>{p.isActive ? "Si" : "No"}</Badge>
                  </Td>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </Card>
    </PlatformAdminLayout>
  );
}
