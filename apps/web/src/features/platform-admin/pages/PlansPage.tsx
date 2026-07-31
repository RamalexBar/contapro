import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { formatCOP } from "@erp/shared-utils";
import { Card } from "../../../components/ui/Card";
import { Button } from "../../../components/ui/Button";
import { Input } from "../../../components/ui/Input";
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
      <h1 className="mb-4 text-lg font-semibold">Planes</h1>

      <Card className="mb-6">
        <h2 className="mb-3 text-sm font-semibold text-gray-700">Nuevo plan</h2>
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
          <Button type="submit" disabled={createMutation.isPending}>
            Crear
          </Button>
        </form>
        {createMutation.isError && <p className="mt-2 text-sm text-red-600">{(createMutation.error as Error).message}</p>}
      </Card>

      <Card>
        {isLoading && <p className="text-sm text-gray-500">Cargando...</p>}
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-gray-200 text-gray-500">
              <th className="py-2">Codigo</th>
              <th>Nombre</th>
              <th>Mensual</th>
              <th>Anual</th>
              <th>Max. sucursales</th>
              <th>Max. usuarios</th>
              <th>Activo</th>
            </tr>
          </thead>
          <tbody>
            {data?.data.map((p) => (
              <tr key={p.id} className="border-b border-gray-100">
                <td className="py-2">{p.code}</td>
                <td>{p.name}</td>
                <td>{formatCOP(p.priceMonthly)}</td>
                <td>{formatCOP(p.priceYearly)}</td>
                <td>{p.maxBranches}</td>
                <td>{p.maxUsers}</td>
                <td>{p.isActive ? "Si" : "No"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    </PlatformAdminLayout>
  );
}
